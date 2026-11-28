// Reconstruct Dr/sF/aF without discarding rich links and color fragments.
type Piece = { kind: 'node'; node: HTMLElement } | { kind: 'break'; blankLines: number };
type BlockState = { element: HTMLElement; original: Node[]; played: boolean; tracks: HTMLElement[]; animations: Animation[]; timer: number };
const motion = { duration: 550, lineStagger: 55, ease: 'cubic-bezier(.215,.61,.355,1)' };
const originalNodes = new WeakMap<HTMLElement, Node[]>();

export function setupAboutReveals(root: HTMLElement) {
  let disposed = false;
  let initialized = false;
  let resizeFrame = 0;
  const states = [...root.querySelectorAll<HTMLElement>('[data-about-rich-text]')].map((element): BlockState => ({
    element, original: originalNodes.get(element) ?? [...element.childNodes].map((node) => node.cloneNode(true)), played: false, tracks: [], animations: [], timer: 0,
  }));
  states.forEach((state)=>originalNodes.set(state.element,state.original));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const state = states.find((item) => item.element === entry.target);
      if (state) play(state, 0);
      observer.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });

  function play(state: BlockState, delay: number) {
    if (state.played || disposed) return;
    state.played = true;
    state.timer = window.setTimeout(() => {
      state.tracks.forEach((track, index) => {
        track.style.willChange = 'transform';
        const animation = track.animate([{ transform: 'translateY(1.15em)' }, { transform: 'translateY(0em)' }], {
          duration: motion.duration, delay: index * motion.lineStagger, easing: motion.ease, fill: 'both',
        });
        state.animations.push(animation);
        animation.finished.then(() => { track.style.willChange = ''; }).catch(() => {});
      });
    }, Math.max(0, delay) * 1000);
  }

  function split(state: BlockState, initial: boolean) {
    const { element } = state;
    state.animations.forEach((animation) => animation.cancel());
    state.animations = [];
    const pieces: Piece[] = [];
    element.replaceChildren(...state.original.map((node) => node.cloneNode(true)));
    const measure = document.createDocumentFragment();
    [...element.childNodes].forEach((part) => {
      if (!(part instanceof HTMLElement)) return;
      if (part.tagName === 'A') {
        part.style.whiteSpace = 'nowrap';
        measure.append(part);
        pieces.push({ kind: 'node', node: part });
        return;
      }
      const text = part.textContent ?? '';
      const tokens = document.documentElement.lang === 'zh-CN'
        ? [...new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(text)].map(segment => segment.segment)
        : text.split(/(\n+|[^\S\n]+)/).filter(Boolean);
      tokens.forEach((token) => {
        if (/^\n+$/.test(token)) {
          pieces.push({ kind: 'break', blankLines: Math.max(0, token.length - 1) });
          for (let index = 0; index < token.length; index++) measure.append(document.createElement('br'));
        } else {
          const node = part.cloneNode(false) as HTMLElement;
          node.textContent = token;
          if (!/^[^\S\n]+$/.test(token)) node.style.whiteSpace = 'nowrap';
          pieces.push({ kind: 'node', node });
          measure.append(node);
        }
      });
    });
    element.replaceChildren(measure);
    const lines: (HTMLElement[] | number)[] = [];
    let line: HTMLElement[] = [];
    let top = Number.NaN;
    const finish = () => { if (line.length) lines.push(line); line = []; top = Number.NaN; };
    pieces.forEach((piece) => {
      if (piece.kind === 'break') { finish(); if (piece.blankLines) lines.push(piece.blankLines); return; }
      const nodeTop = piece.node.offsetTop;
      if (!Number.isNaN(top) && Math.abs(nodeTop - top) > 1) finish();
      if (Number.isNaN(top)) top = nodeTop;
      line.push(piece.node);
    });
    finish();
    state.tracks = [];
    const output = document.createDocumentFragment();
    lines.forEach((nodes) => {
      if (typeof nodes === 'number') {
        const spacer = document.createElement('span');
        spacer.className = 'about-line-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        spacer.style.height = (nodes * 1.2) + 'em';
        output.append(spacer);
        return;
      }
      const clip = document.createElement('span');
      const track = document.createElement('span');
      clip.className = 'about-line-clip';
      track.className = 'about-line-track';
      track.append(...nodes);
      clip.append(track);
      output.append(clip);
      state.tracks.push(track);
      track.style.transform = state.played ? '' : 'translateY(1.15em)';
    });
    element.replaceChildren(output);
    if (state.played) return;
    const rect = element.getBoundingClientRect();
    if (initial && rect.bottom > 0 && rect.top < window.innerHeight) play(state, Number(element.dataset.baseDelay) || 0);
    else observer.observe(element);
  }

  const ready = async () => {
    try {
      if (reduced.matches) return;
      await document.fonts.ready;
      if (disposed || reduced.matches) return;

      // Once the text is visible, leave it visible even if the fonts arrived late.
      const firstBlock = states[0]?.element;
      const canReveal = root.hasAttribute('data-about-reveal-pending')
        && firstBlock && getComputedStyle(firstBlock).visibility === 'hidden';
      if (canReveal) {
        states.forEach(state => split(state, true));
        initialized = true;
      }
    } finally {
      root.removeAttribute('data-about-reveal-pending');
    }
  };
  const resize = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { if (initialized && !disposed && !reduced.matches) states.forEach((state) => split(state, false)); });
  };
  window.addEventListener('resize', resize);
  ready();
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    cancelAnimationFrame(resizeFrame);
    window.removeEventListener('resize', resize);
    states.forEach((state) => {
      window.clearTimeout(state.timer);
      // The outgoing page remains visible during its route fade. Keep each
      // line at its current position when its entrance animation is cancelled.
      const transforms = state.tracks.map((track) => getComputedStyle(track).transform);
      state.animations.forEach((animation) => animation.cancel());
      state.tracks.forEach((track, index) => { track.style.transform = transforms[index] || ''; });
    });
  };
}
