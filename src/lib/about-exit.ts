type StyleNode = HTMLStyleElement | HTMLLinkElement;
type InlineStyle = [string, string, string][];

export type AboutExit = {
  prepareSwap: (next: Document) => void;
  afterSwap: () => void;
  cancel: () => void;
};

const saveInline = (element: HTMLElement, properties: string[]): InlineStyle => properties.map(property => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
const restoreInline = (element: HTMLElement, snapshot: InlineStyle) => snapshot.forEach(([property, value, priority]) => value ? element.style.setProperty(property, value, priority) : element.style.removeProperty(property));
const move = (parent: HTMLElement, element: HTMLElement, before: ChildNode | null = null) => {
  const atomic = (parent as HTMLElement & { moveBefore?: (node: Node, child: Node | null) => void }).moveBefore;
  if (atomic && element.isConnected) atomic.call(parent, element, before);
  else parent.insertBefore(element, before);
};
const freezeRect = (element: HTMLElement, rect: DOMRect) => Object.assign(element.style, {
  position: 'fixed', top: rect.top + 'px', left: rect.left + 'px', right: 'auto', bottom: 'auto',
  width: rect.width + 'px', height: rect.height + 'px', margin: '0', transform: 'none',
  zIndex: '10', pointerEvents: 'none',
});
const hasStyle = (next: Document, node: StyleNode) => [...next.head.querySelectorAll<StyleNode>('style,link[rel="stylesheet"]')].some(candidate => {
  if (node instanceof HTMLLinkElement) return candidate instanceof HTMLLinkElement && candidate.href === node.href;
  return candidate instanceof HTMLStyleElement && (candidate.textContent === node.textContent || !!node.dataset.viteDevId && candidate.dataset.viteDevId === node.dataset.viteDevId);
});
const aboutStyles = () => [...document.head.querySelectorAll<StyleNode>('style,link[rel="stylesheet"]')].filter(node => {
  let css = node instanceof HTMLStyleElement ? node.textContent ?? '' : '';
  try { css += [...(node.sheet?.cssRules ?? [])].map(rule => rule.cssText).join(''); } catch {}
  return /\.about-(?:route|content|rich-text|bottom-fade|globe-slot)\b/.test(css);
});

// Match the desktop return's exponential scroll easing after Astro resets scroll.
const scrollReturnFrames = Array.from({ length: 31 }, (_, index) => {
  const offset = index / 30;
  return { offset, remaining: index === 0 ? 1 : Math.max(0, 2 ** (-10 * offset) - .001) };
});

// Text belongs to the outgoing page; the persisted globe has its own, longer
// visibility track. Keep their opacity independent across Astro's body swap.
export function startAboutExit(returnDuration: number, onComplete: () => void): AboutExit {
  const main = document.querySelector<HTMLElement>('[data-about-page]');
  const slot = document.querySelector<HTMLElement>('[data-about-globe]');
  const canvas = slot?.querySelector<HTMLCanvasElement>('.travel-globe');
  const caption = slot?.querySelector<HTMLElement>(':scope > span');
  const slotParent = slot?.parentElement;
  const slotNext = slot?.nextSibling ?? null;
  const slotInline = slot?.getAttribute('style') ?? null;
  const captionDisplay = caption ? saveInline(caption, ['display']) : [];
  const mainInline = main?.getAttribute('style') ?? null;
  const mainInert = main?.inert ?? false;
  const mainAria = main?.getAttribute('aria-hidden') ?? null;
  const globeRect = slot?.getBoundingClientRect();
  const canvasInline = canvas ? saveInline(canvas, ['opacity', 'scale', 'transition', 'will-change']) : [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = innerWidth > 768;
  const styles = aboutStyles();
  const retained: { original: StyleNode; clone: StyleNode }[] = [];
  let mainRect = main?.getBoundingClientRect();
  let mainAnimation: Animation | undefined, globeAnimation: Animation | undefined;
  let mainScroll: Animation | undefined, headerScroll: Animation | undefined;
  let scrollOffset = 0;
  let headerSettled = true;
  let globePlaceholder: HTMLDivElement | undefined;
  let preload: HTMLElement | null = null, preloadInline: string | null = null;
  let swapped = false, stopped = false, mainDone = !main, globeDone = !canvas;
  let mainRemoved = false, globeRemoved = false;

  const finish = () => {
    if (stopped || !swapped) return;
    if (mainDone && !mainRemoved) {
      mainRemoved = true; main?.remove(); mainAnimation?.cancel(); mainScroll?.cancel();
      retained.forEach(({ original, clone }) => { original.remove(); clone.remove(); });
    }
    if (globeDone && !globeRemoved) {
      globeRemoved = true; slot?.remove();
      if (preload) {
        if (preloadInline === null) preload.removeAttribute('style');
        else preload.setAttribute('style', preloadInline);
      }
      // Restore only our tracks; the scene owns the canvas's magnetic translate.
      if (canvas) restoreInline(canvas, canvasInline);
      globeAnimation?.cancel();
    }
    if (mainDone && globeDone && headerSettled) { stopped = true; onComplete(); }
  };

  if (slot && globeRect) {
    if (!desktop) {
      // Keep the globe's space until swap so removing it cannot cut the mobile
      // scroll range short and shift the outgoing text.
      const { height, marginTop, marginBottom } = getComputedStyle(slot);
      globePlaceholder = document.createElement('div');
      Object.assign(globePlaceholder.style, { height, marginTop, marginBottom });
      slot.before(globePlaceholder);
    }
    freezeRect(slot, globeRect);
    slot.style.animation = 'none';
    move(document.body, slot);
    if (caption) caption.style.display = 'none';
  }
  if (main) {
    main.inert = true; main.setAttribute('aria-hidden', 'true');
    main.style.pointerEvents = 'none';
    const from = getComputedStyle(main).opacity;
    main.style.opacity = '0';
    mainAnimation = main.animate([{ opacity: from }, { opacity: 0 }], { duration: reduced ? 0 : 300, easing: 'ease-out', fill: 'both' });
    void mainAnimation.finished.then(() => { mainDone = true; finish(); }).catch(() => {});
  }
  if (canvas) {
    const current = getComputedStyle(canvas);
    const from: Keyframe = { opacity: current.opacity };
    const to: Keyframe = { opacity: 0 };
    if (desktop) { from.scale = current.scale === 'none' ? '1' : current.scale; to.scale = '.92'; }
    canvas.style.transition = 'none';
    canvas.style.willChange = desktop ? 'opacity, scale' : 'opacity';
    canvas.style.opacity = '0';
    if (desktop) canvas.style.scale = '.92';
    globeAnimation = canvas.animate([from, to], { duration: reduced ? 0 : 700, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
    void globeAnimation.finished.then(() => { globeDone = true; finish(); }).catch(() => {});
  }

  return {
    prepareSwap(next) {
      if (stopped) return;
      if (desktop) {
        mainRect = main?.getBoundingClientRect();
        if (!reduced) scrollOffset = Math.max(0, scrollY);
      }
      if (mainDone) return;
      // Retain the original Vite nodes instead of inserting duplicate HMR ids.
      styles.filter(node => !hasStyle(next, node)).forEach(original => {
        const clone = original.cloneNode(true) as StyleNode;
        retained.push({ original, clone }); next.head.append(clone);
      });
    },
    afterSwap() {
      if (stopped) return;
      swapped = true;
      globePlaceholder?.remove();
      preload = document.querySelector<HTMLElement>('.travel-preload');
      if (!globeDone && preload && globeRect) {
        preloadInline = preload.getAttribute('style');
        freezeRect(preload, globeRect);
        Object.assign(preload.style, { opacity: '1', overflow: 'visible', animation: 'none' });
      }
      if (!mainDone && main && mainRect) {
        freezeRect(main, mainRect);
        main.style.zIndex = '9';
        main.dataset.aboutExit = '';
        main.removeAttribute('data-about-page');
        main.querySelector('[data-about-globe]')?.remove();
        document.body.append(main);
      }
      if (scrollOffset > 0) {
        const header = document.querySelector('[data-home-header]');
        if (header) {
          headerSettled = false;
          headerScroll = header.animate(scrollReturnFrames.map(({ offset, remaining }) => ({
            offset,
            translate: '0 ' + (-scrollOffset * remaining) + 'px',
          })), returnDuration);
          void headerScroll.finished.then(() => {
            headerSettled = true;
            finish();
          }).catch(() => {});
        }
        if (!mainDone && main && mainRect) {
          const settledTop = mainRect.top + scrollOffset;
          mainScroll = main.animate(scrollReturnFrames.map(({ offset, remaining }) => ({
            offset,
            top: (settledTop - scrollOffset * remaining) + 'px',
          })), returnDuration);
        }
      }
      finish();
    },
    cancel() {
      if (stopped) return;
      stopped = true; mainAnimation?.cancel(); globeAnimation?.cancel();
      mainScroll?.cancel(); headerScroll?.cancel();
      retained.forEach(({ original, clone }) => { if (swapped) original.remove(); clone.remove(); });
      if (swapped) {
        main?.remove(); slot?.remove();
        if (preload) {
          if (preloadInline === null) preload.removeAttribute('style');
          else preload.setAttribute('style', preloadInline);
        }
      } else {
        if (main) {
          if (mainInline === null) main.removeAttribute('style'); else main.setAttribute('style', mainInline);
          main.inert = mainInert;
          if (mainAria === null) main.removeAttribute('aria-hidden'); else main.setAttribute('aria-hidden', mainAria);
        }
        if (slot && slotParent) {
          move(slotParent, slot, slotNext?.parentNode === slotParent ? slotNext : null);
          if (slotInline === null) slot.removeAttribute('style'); else slot.setAttribute('style', slotInline);
        }
        if (caption) restoreInline(caption, captionDisplay);
      }
      globePlaceholder?.remove();
      if (canvas) restoreInline(canvas, canvasInline);
    },
  };
}
