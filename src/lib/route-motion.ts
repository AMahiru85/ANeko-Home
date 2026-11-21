import { startAboutExit, type AboutExit } from './about-exit';

let installed = false;
let previousPath = '';
let cleanupTimer = 0;
let generation = 0;
let aboutExit: AboutExit | undefined;
type PreparationEvent = Event & { from?: URL; to?: URL; signal?: AbortSignal };
type SwapEvent = Event & { newDocument?: Document; swap?: () => void };

type Direction = 'home-about' | 'about-home';
const isAbout = (path: string) => path === '/about' || path === '/about/';
const duration = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : innerWidth > 768 ? 1200 : 800;

function syncAuthor(path: string) {
  const about = isAbout(path);
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
  previousPath = location.pathname;
  syncAuthor(previousPath);

  document.addEventListener('astro:before-preparation', event => {
    const { to, from, signal } = event as PreparationEvent;
    if (!to) return;
    const current = ++generation;
    aboutExit?.cancel(); aboutExit = undefined;
    clearTransition();
    const origin = from?.pathname ?? previousPath;
    const direction: Direction | undefined = origin === '/' && isAbout(to.pathname)
      ? 'home-about' : isAbout(origin) && to.pathname === '/' ? 'about-home' : undefined;
    if (direction) {
      document.documentElement.dataset.routeTransition = direction;
      document.documentElement.style.setProperty('--route-transition-duration', duration() + 'ms');
    }
    if (direction === 'about-home') aboutExit = startAboutExit(duration(), () => {
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
      next.documentElement.style.setProperty('--route-transition-duration', duration() + 'ms');
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
    const direction = document.documentElement.dataset.routeTransition;
    if (direction === 'about-home') return;
    clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(() => {
      if (current === generation) clearTransition();
    }, duration() + 80);
  });

  document.addEventListener('astro:after-swap', () => {
    // Align the destination before page scripts measure the shared header.
    syncAuthor(location.pathname);
  });
}
