import { getHomeIntroSnapshot, subscribeHomeIntro, type HomeIntroSnapshot } from './home-intro';

// TI and wI share the same loader stages as QI. Keep the three transform owners separate.
const easing = 'cubic-bezier(.32,0,0,1)';
export function bindHomeHeader(root: HTMLElement) {
  const animations = new Map<HTMLElement, Animation>();
  const targets = new Map<HTMLElement, string>();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let previous: HomeIntroSnapshot | undefined;
  let disposed = false;
  const motion = (node: HTMLElement, property: 'transform' | 'opacity', target: string, duration: number) => {
    if (targets.get(node) === target) return;
    targets.set(node, target);
    const from = getComputedStyle(node)[property];
    animations.get(node)?.cancel();
    node.style[property] = target;
    if (reduced || duration === 0 || from === target) return;
    const animation = node.animate([{ [property]: from }, { [property]: target }], { duration, easing, fill: 'both' });
    animations.set(node, animation);
    animation.onfinish = () => {
      if (animations.get(node) === animation) { animations.delete(node); animation.cancel(); }
    };
  };
  const mobile = () => window.innerWidth <= 768;
  const apply = (snapshot: HomeIntroSnapshot) => {
    if (disposed) return;
    // Vue islands can replace slotted nodes during client hydration. Resolve the
    // current nodes for every snapshot so the final interactive state lands on
    // the live DOM rather than a stale server-rendered reference.
    const heading = root.querySelector<HTMLElement>('[data-home-heading]');
    const scale = root.querySelector<HTMLElement>('[data-home-heading-scale]');
    const opacity = root.querySelector<HTMLElement>('[data-home-heading-opacity]');
    const about = root.querySelector<HTMLElement>('[data-home-about-enter]');
    const icon = root.querySelector<HTMLElement>('[data-home-about-icon]');
    const link = root.querySelector<HTMLAnchorElement>('[data-home-about-link]');
    if (!heading || !scale || !opacity || !about || !icon) return;
    const first = !previous;
    const playing = snapshot.playing;
    if (first) {
      scale.style.transformOrigin = mobile() && playing ? 'center center' : '100% 100%';
      scale.style.transform = playing ? 'scale(.5)' : 'scale(1)';
      opacity.style.opacity = playing ? '0' : '1';
      about.style.transform = playing && snapshot.stage < 2 ? 'translateY(28px)' : 'translateY(0px)';
      about.style.opacity = playing && snapshot.stage < 2 ? '0' : '1';
      icon.style.transform = playing ? 'translateY(-135%)' : 'translateY(0%)';
    }
    const rootSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
    const offset = mobile() && playing && snapshot.stage < 1 ? window.innerHeight / 2 - 2 * rootSize - heading.offsetHeight / 2 : 0;
    if (first) heading.style.transform = 'translateY(' + offset + 'px)';
    motion(heading, 'transform', 'translateY(' + offset + 'px)', mobile() && playing && snapshot.stage >= 1 ? 1080 : 0);
    motion(scale, 'transform', 'scale(' + (playing && snapshot.stage < 1 ? '.72' : '1') + ')', playing ? 1080 : 0);
    motion(opacity, 'opacity', '1', playing ? 1080 : 0);
    const showActions = !playing || snapshot.stage >= 2;
    motion(about, 'transform', showActions ? 'translateY(0px)' : 'translateY(28px)', playing ? 720 : 0);
    // Opacity and y use distinct nested owners so one animation cannot cancel the other.
    about.style.opacity = showActions ? '1' : '0';
    about.style.transition = reduced ? 'none' : 'opacity .72s ' + easing;
    motion(icon, 'transform', showActions ? 'translateY(0%)' : 'translateY(-135%)', mobile() ? 800 : 1200);
    if (link) { link.tabIndex = showActions ? 0 : -1; link.style.pointerEvents = showActions ? 'auto' : 'none'; }
    root.dataset.homeHeaderStage = String(snapshot.stage);
    root.dataset.homeHeaderPlaying = String(playing);
    root.dataset.homeHeaderReady = 'true';
    previous = snapshot;
  };
  apply(getHomeIntroSnapshot());
  const unsubscribe = subscribeHomeIntro(apply);
  const controls = new MutationObserver(() => apply(previous ?? getHomeIntroSnapshot()));
  controls.observe(root, { childList: true, subtree: true });
  const resize = () => { if (previous) apply(previous); };
  window.addEventListener('resize', resize);
  return () => { disposed = true; unsubscribe(); controls.disconnect(); window.removeEventListener('resize', resize); animations.forEach(animation => animation.cancel()); };
}
