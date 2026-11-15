let installed = false;
let previousPath = '';

const pathOf = (value: unknown) => {
  if (value && typeof (value as { pathname?: unknown }).pathname === 'string') {
    return (value as { pathname: string }).pathname;
  }
  return location.pathname;
};
const homePath = (path: string) => path === '/' || path === '';
const aboutPath = (path: string) => path.startsWith('/about');

export function installRouteMotion() {
  if (installed) return;
  installed = true;
  previousPath = location.pathname;

  document.addEventListener('astro:before-preparation', event => {
    const to = (event as Event & { to?: URL }).to;
    if (!to) return;
    const from = previousPath || location.pathname;
    const target = pathOf(to);
    if ((homePath(from) && aboutPath(target)) || (aboutPath(from) && homePath(target))) {
      document.documentElement.dataset.routeTransition = homePath(from) ? 'home-about' : 'about-home';
    }
  });

  document.addEventListener('astro:before-swap', event => {
    const next = (event as Event & { newDocument?: Document }).newDocument;
    const transition = document.documentElement.dataset.routeTransition;
    if (next && transition) next.documentElement.dataset.routeTransition = transition;
  });

  document.addEventListener('astro:page-load', () => {
    previousPath = location.pathname;
    delete document.documentElement.dataset.routeTransition;
    delete document.documentElement.dataset.authorRoutePending;
    delete document.documentElement.dataset.authorActionsPending;
  });
}
