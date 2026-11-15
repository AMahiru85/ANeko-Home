let installed = false;
let previousPath = '';
let cleanupTimer = 0;
let globeHideTimer = 0;
let generation = 0;

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
  clearTimeout(globeHideTimer);
  delete document.documentElement.dataset.routeTransition;
  delete document.documentElement.dataset.routeGlobeHidden;
  document.documentElement.style.removeProperty('--route-transition-duration');
}

export function installRouteMotion() {
  if (installed) return;
  installed = true;
  previousPath = location.pathname;
  syncAuthor(previousPath);

  document.addEventListener('astro:before-preparation', event => {
    const to = (event as Event & { to?: URL }).to;
    if (!to) return;
    generation++;
    clearTransition();
    const direction: Direction | undefined = previousPath === '/' && isAbout(to.pathname)
      ? 'home-about' : isAbout(previousPath) && to.pathname === '/' ? 'about-home' : undefined;
    if (direction) {
      document.documentElement.dataset.routeTransition = direction;
      document.documentElement.style.setProperty('--route-transition-duration', duration() + 'ms');
    }
    syncAuthor(to.pathname);
  });

  document.addEventListener('astro:before-swap', event => {
    const next = (event as Event & { newDocument?: Document; to?: URL }).newDocument;
    if (!next) return;
    const direction = document.documentElement.dataset.routeTransition;
    if (direction) {
      next.documentElement.dataset.routeTransition = direction;
      next.documentElement.style.setProperty('--route-transition-duration', duration() + 'ms');
    }
    next.documentElement.dataset.authorRoute = next.querySelector('[data-about-page]') ? 'about' : 'home';
  });

  document.addEventListener('astro:page-load', () => {
    previousPath = location.pathname;
    syncAuthor(previousPath);
    const current = generation;
    const direction = document.documentElement.dataset.routeTransition;
    delete document.documentElement.dataset.routeGlobeHidden;
    clearTimeout(globeHideTimer);
    if (direction === 'about-home') {
      globeHideTimer = window.setTimeout(() => {
        if (current === generation) document.documentElement.dataset.routeGlobeHidden = 'true';
      }, 600);
    }
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
