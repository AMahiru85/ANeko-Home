import { isAboutPath, isHomePath, languageFromPath, localizedPath } from './locale';
import { startAboutExit, type AboutExit } from './about-exit';

let installed = false;
let previousPath = '';
let cleanupTimer = 0;
let generation = 0;
let aboutExit: AboutExit | undefined;
type PreparationEvent = Event & { from?: URL; to?: URL; signal?: AbortSignal };
type SwapEvent = Event & { newDocument?: Document; swap?: () => void; viewTransition?: ViewTransition };

type Direction = 'home-about' | 'about-home' | 'language';

function duration(direction: Direction) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  if (direction === 'language') return 220;
  return innerWidth > 768 ? 1200 : 800;
}

function syncAuthor(path: string) {
  const about = isAboutPath(path);
  document.documentElement.dataset.authorRoute = about ? 'about' : 'home';
  const user = document.querySelector('.author-user-route') as HTMLElement | null;
  if (user) {
    user.inert = about;
    user.setAttribute('aria-hidden', String(about));
  }
  window.dispatchEvent(new CustomEvent('gabriel:author-route', { detail: { pathname: path } }));
}

function clearTransition() {
  clearTimeout(cleanupTimer);
  delete document.documentElement.dataset.routeTransition;
  document.documentElement.style.removeProperty('--route-transition-duration');
}

export function installRouteMotion() {
  if (installed) return;
  installed = true;
  let languageTransitionFinished: Promise<void> | undefined;
  previousPath = location.pathname;
  syncAuthor(previousPath);

  document.addEventListener('astro:before-preparation', event => {
    const { to, from, signal } = event as PreparationEvent;
    if (!to) return;
    const current = ++generation;
    aboutExit?.cancel(); aboutExit = undefined;
    clearTransition();
    languageTransitionFinished = undefined;
    const origin = from?.pathname ?? previousPath;
    const languageChange = languageFromPath(origin) !== languageFromPath(to.pathname)
      && localizedPath(origin, 'en') === localizedPath(to.pathname, 'en');
    const direction: Direction | undefined = isHomePath(origin) && isAboutPath(to.pathname)
      ? 'home-about' : isAboutPath(origin) && isHomePath(to.pathname) ? 'about-home' : languageChange ? 'language' : undefined;
    if (direction) {
      document.documentElement.dataset.routeTransition = direction;
      document.documentElement.style.setProperty('--route-transition-duration', duration(direction) + 'ms');
    }
    if (direction === 'about-home') aboutExit = startAboutExit(duration(direction), () => {
      if (current !== generation) return;
      aboutExit = undefined; clearTransition();
    });
    signal?.addEventListener('abort', () => {
      if (current !== generation) return;
      aboutExit?.cancel(); aboutExit = undefined; clearTransition();
      syncAuthor(location.pathname);
    }, { once: true });
    syncAuthor(to.pathname);
  });

  document.addEventListener('astro:before-swap', event => {
    const swapEvent = event as SwapEvent;
    const next = swapEvent.newDocument;
    if (!next) return;
    const direction = document.documentElement.dataset.routeTransition;
    if (direction) {
      next.documentElement.dataset.routeTransition = direction;
      next.documentElement.style.setProperty('--route-transition-duration', document.documentElement.style.getPropertyValue('--route-transition-duration'));
    }
    if (direction === 'language') {
      languageTransitionFinished = swapEvent.viewTransition?.finished;
      next.querySelector('[data-about-reveal-pending]')?.removeAttribute('data-about-reveal-pending');
    }
    next.documentElement.dataset.authorRoute = next.querySelector('[data-about-page]') ? 'about' : 'home';
    if (aboutExit && swapEvent.swap) {
      const exit = aboutExit, current = generation, swap = swapEvent.swap;
      exit.prepareSwap(next);
      // Astro invokes swap synchronously and does not await an async override.
      swapEvent.swap = () => {
        swap();
        if (current === generation) exit.afterSwap();
      };
    }
  });

  document.addEventListener('astro:page-load', () => {
    previousPath = location.pathname;
    syncAuthor(previousPath);
    const current = generation;
    const direction = document.documentElement.dataset.routeTransition as Direction | undefined;
    if (!direction || direction === 'about-home') return;
    if (direction === 'language' && languageTransitionFinished) {
      const cleanup = () => { if (current === generation) clearTransition(); };
      void languageTransitionFinished.then(cleanup, cleanup);
      return;
    }
    clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(() => {
      if (current === generation) clearTransition();
    }, duration(direction) + 80);
  });

  document.addEventListener('astro:after-swap', () => {
    // Align the destination before page scripts measure the shared header.
    syncAuthor(location.pathname);
  });
}
