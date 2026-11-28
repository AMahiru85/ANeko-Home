const targets = [
  { selector: '.intro-title-mask', text: true },
  { selector: '.intro-subtitle-mask', text: true },
  { selector: '.intro-actions, .about-author-actions', text: false },
  { selector: '.language-picker', text: false },
];

function measureTarget(selector: string, text: boolean) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element || element.getClientRects().length === 0) return;
  const bounds = element.getBoundingClientRect();
  const textElement = element.firstElementChild;
  const fontSize = text && textElement && element.offsetWidth
    ? parseFloat(getComputedStyle(textElement).fontSize) * (bounds.width / element.offsetWidth)
    : 1;
  const visible = bounds.width > 0 && bounds.height > 0
    && bounds.bottom > 0 && bounds.top < innerHeight
    && bounds.right > 0 && bounds.left < innerWidth;
  return { element, bounds, fontSize, visible };
}

export function captureAuthorTransition() {
  const previous = targets.map(({ selector, text }) => measureTarget(selector, text));
  return () => {
    // Measure the destination after Astro restores the destination scroll position.
    const next = targets.map(({ selector, text }) => measureTarget(selector, text));
    return next.flatMap((target, index) => {
      if (!target?.visible) return [];
      const origin = previous[index];
      const settings = { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' } as const;
      if (!origin?.visible) {
        return [target.element.animate([{ opacity: 0 }, { opacity: 1 }], settings)];
      }

      const x = origin.bounds.left - target.bounds.left;
      const y = origin.bounds.top - target.bounds.top;
      const scale = origin.fontSize / target.fontSize;
      if (Math.abs(x) < .5 && Math.abs(y) < .5 && Math.abs(scale - 1) < .01) return [];

      return [target.element.animate([
        { translate: `${x}px ${y}px`, scale, transformOrigin: 'top left' },
        { translate: '0px 0px', scale: 1, transformOrigin: 'top left' },
      ], settings)];
    });
  };
}
