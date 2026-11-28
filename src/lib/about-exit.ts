type InlineStyle = [string, string, string][];

export type AboutExit = {
  contentFinished: Promise<void>;
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
// Finish fading the live About content before Astro removes it.
// The persisted canvas is the only outgoing layer carried across the swap.
export function startAboutExit(onComplete: () => void): AboutExit {
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
  const contentAnimations: Animation[] = [];
  const contentFade = { duration: 180, easing: 'ease-out', fill: 'both' } as const;
  let globeAnimation: Animation | undefined;
  let globePlaceholder: HTMLDivElement | undefined;
  let preload: HTMLElement | null = null, preloadInline: string | null = null;
  let swapped = false, stopped = false, globeDone = !canvas;
  let globeRemoved = false;

  const finish = () => {
    if (stopped || !swapped) return;
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
    if (globeDone) { stopped = true; onComplete(); }
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
    if (!reduced) {
      contentAnimations.push(main.animate([{ opacity: from }, { opacity: 0 }], contentFade));
    }
  }
  const mobileHeading = !desktop && !reduced
    ? document.querySelector<HTMLElement>('[data-about-author] [data-home-heading]')
    : null;
  if (mobileHeading) {
    const opacity = getComputedStyle(mobileHeading).opacity;
    contentAnimations.push(mobileHeading.animate([{ opacity }, { opacity: 0 }], contentFade));
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
    contentFinished: Promise.allSettled(contentAnimations.map(animation => animation.finished)).then(() => undefined),
    afterSwap() {
      if (stopped) return;
      swapped = true;
      contentAnimations.forEach(animation => animation.cancel());
      globePlaceholder?.remove();
      preload = document.querySelector<HTMLElement>('.travel-preload');
      if (!globeDone && preload && globeRect) {
        preloadInline = preload.getAttribute('style');
        freezeRect(preload, globeRect);
        Object.assign(preload.style, { opacity: '1', overflow: 'visible', animation: 'none' });
      }
      finish();
    },
    cancel() {
      if (stopped) return;
      stopped = true;
      contentAnimations.forEach(animation => animation.cancel());
      globeAnimation?.cancel();
      if (swapped) {
        slot?.remove();
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
