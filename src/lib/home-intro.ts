export type HomeIntroSnapshot = Readonly<{ stage: number; playing: boolean }>;
export type HomeIntroProject = {
  video?: string | null;
  mobileVideo?: string | null;
};

// GF / YF / XF and pa in the captured source bundle. All values are milliseconds.
export const HOME_INTRO_TIMING = { minimum: 1080, readyDelay: 180, resourceDeadline: 3000, text: 80, cta: 360, stack: 360, active: 500, minimap: 1260, complete: 1920 } as const;
type Listener = (snapshot: HomeIntroSnapshot) => void;
type Controller = { snapshot: HomeIntroSnapshot; started: boolean; listeners: Set<Listener>; run: (projects: readonly HomeIntroProject[]) => void };
declare global {
  interface Window { __gabrielInitialPathname?: string; __gabrielHomeIntro?: Controller }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(); return; }
    let timer = 0;
    const done = () => { window.clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    signal.addEventListener('abort', done, { once: true });
    timer = window.setTimeout(done, milliseconds);
  });
}

function prepareMobileVideo(project: HomeIntroProject, signal: AbortSignal): Promise<void> {
  const src = project.mobileVideo?.trim() || project.video?.trim();
  if (!src || signal.aborted || !/\.(mp4|webm|ogv|mov|m4v)(?:[?#]|$)/i.test(src)) return Promise.resolve();
  const absolute = new URL(src, location.href).href;
  const existing = Array.from(document.querySelectorAll<HTMLVideoElement>('[data-card-offset="0"] video')).find(video => (video.currentSrc || video.src) === absolute);
  const video = existing || document.createElement('video');
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise(resolve => {
    let timer = 0, settled = false;
    const done = () => {
      if (settled) return; settled = true; window.clearTimeout(timer);
      video.removeEventListener('loadeddata', done); video.removeEventListener('canplay', done); video.removeEventListener('error', done);
      signal.removeEventListener('abort', done);
      if (!existing) { video.pause(); video.removeAttribute('src'); video.load(); }
      resolve();
    };
    video.addEventListener('loadeddata', done); video.addEventListener('canplay', done); video.addEventListener('error', done);
    signal.addEventListener('abort', done, { once: true }); timer = window.setTimeout(done, 5000);
    if (!existing) { video.preload = 'auto'; video.muted = true; video.playsInline = true; video.src = src; }
    if (!existing || video.networkState === HTMLMediaElement.NETWORK_EMPTY) { try { video.load(); } catch { done(); } }
  });
}

async function resources(project: HomeIntroProject | undefined, mobile: boolean, signal: AbortSignal) {
  if (!project || signal.aborted) return;
  const gate = new AbortController(), abort = () => gate.abort();
  signal.addEventListener('abort', abort, { once: true });
  try {
    await Promise.race([
      (mobile ? prepareMobileVideo(project, gate.signal) : Promise.resolve()),
      delay(HOME_INTRO_TIMING.resourceDeadline, gate.signal),
    ]);
  } catch { /* Resource errors complete the original gate as well. */ }
  finally { gate.abort(); signal.removeEventListener('abort', abort); }
}

function controller(): Controller {
  if (window.__gabrielHomeIntro) return window.__gabrielHomeIntro;
  let navigationPath = location.pathname;
  try { const entry = performance.getEntriesByType('navigation')[0]; if (entry?.name) navigationPath = new URL(entry.name).pathname; } catch {}
  const entryPath = window.__gabrielInitialPathname ?? navigationPath;
  window.__gabrielInitialPathname = entryPath;
  const initial = entryPath === '/' && location.pathname === '/';
  const listeners = new Set<Listener>(), timers = new Set<number>();
  let abortController: AbortController | undefined;
  const publish = (stage: number, playing: boolean) => {
    instance.snapshot = Object.freeze({ stage, playing });
    document.documentElement.dataset.homeIntroStage = String(stage);
    document.documentElement.dataset.homeIntroPlaying = String(playing);
    listeners.forEach(listener => listener(instance.snapshot));
    window.dispatchEvent(new CustomEvent('gabriel:home-intro', { detail: instance.snapshot }));
  };
  const detach = () => { document.removeEventListener('astro:before-swap', finish); window.removeEventListener('pagehide', finish); };
  const finish = () => {
    abortController?.abort(); timers.forEach(window.clearTimeout); timers.clear(); detach(); publish(5, false);
  };
  const schedule = (milliseconds: number, callback: () => void) => {
    const timer = window.setTimeout(() => { timers.delete(timer); callback(); }, milliseconds); timers.add(timer);
  };
  const instance: Controller = {
    snapshot: Object.freeze({ stage: initial ? 0 : 5, playing: initial }), started: !initial, listeners,
    run(projects) {
      if (instance.started) return; instance.started = true;
      if (location.pathname !== '/') { finish(); return; }
      abortController = new AbortController(); const { signal } = abortController;
      document.addEventListener('astro:before-swap', finish, { once: true }); window.addEventListener('pagehide', finish, { once: true });
      const cursor = window.__gabrielCarouselCursor ?? 0;
      const selected = projects.length ? projects[((cursor % projects.length) + projects.length) % projects.length] ?? projects[0] : undefined;
      void (async () => {
        await Promise.all([delay(HOME_INTRO_TIMING.minimum, signal), resources(selected, window.innerWidth < 769, signal)]);
        if (signal.aborted) return;
        await delay(HOME_INTRO_TIMING.readyDelay, signal); if (signal.aborted) return;
        schedule(HOME_INTRO_TIMING.text, () => publish(1, true));
        schedule(HOME_INTRO_TIMING.cta, () => publish(2, true));
        schedule(HOME_INTRO_TIMING.stack, () => publish(3, true));
        schedule(HOME_INTRO_TIMING.active, () => publish(4, true));
        schedule(HOME_INTRO_TIMING.minimap, () => publish(5, true));
        schedule(HOME_INTRO_TIMING.complete, finish);
      })().catch(finish);
    },
  };
  window.__gabrielHomeIntro = instance;
  document.documentElement.dataset.homeIntroStage = String(instance.snapshot.stage);
  document.documentElement.dataset.homeIntroPlaying = String(instance.snapshot.playing);
  return instance;
}

export function getHomeIntroSnapshot(): HomeIntroSnapshot {
  return typeof window === 'undefined' ? { stage: 0, playing: true } : controller().snapshot;
}
export function subscribeHomeIntro(listener: Listener): () => void {
  if (typeof window === 'undefined') return () => {};
  const state = controller(); state.listeners.add(listener); listener(state.snapshot);
  return () => state.listeners.delete(listener);
}
export function ensureHomeIntro(projects: readonly HomeIntroProject[]): void {
  if (typeof window !== 'undefined') controller().run(projects);
}