interface AnchoredMenuOptions {
  margin?: number;
  minHeight?: number;
  preferredMinVisibleHeight?: number;
}

export function positionTopbarFloatingElement(
  element: HTMLElement,
  left: number,
  top: number,
): void {
  const frame = element.closest<HTMLElement>(".topbar")?.getBoundingClientRect();
  element.style.left = `${Math.round(left - (frame?.left ?? 0))}px`;
  element.style.top = `${Math.round(top - (frame?.top ?? 0))}px`;
}

export function positionSimpleTopbarMenu(
  menuElement: HTMLElement,
  triggerElement: HTMLElement,
  margin = 8,
): void {
  const trigger = triggerElement.getBoundingClientRect();
  const menu = menuElement.getBoundingClientRect();
  const left = Math.min(Math.max(trigger.left, margin), window.innerWidth - menu.width - margin);
  const openBelow = trigger.bottom + menu.height + margin <= window.innerHeight;
  const top = openBelow ? trigger.bottom + margin : trigger.top - menu.height - margin;

  positionTopbarFloatingElement(menuElement, left, Math.max(margin, top));
}

export function positionAnchoredTopbarMenu(
  menuElement: HTMLElement,
  triggerElement: HTMLElement,
  options: AnchoredMenuOptions = {},
): number {
  const margin = options.margin ?? 8;
  const minHeight = options.minHeight ?? 112;
  const preferredMinVisibleHeight = options.preferredMinVisibleHeight ?? 180;
  const trigger = triggerElement.getBoundingClientRect();
  const menu = menuElement.getBoundingClientRect();
  const left = Math.min(Math.max(trigger.left, margin), window.innerWidth - menu.width - margin);
  const belowTop = trigger.bottom + margin;
  const belowSpace = window.innerHeight - belowTop - margin;
  const aboveSpace = trigger.top - margin * 2;
  const openBelow =
    belowSpace >= Math.min(menu.height, preferredMinVisibleHeight) || belowSpace >= aboveSpace;
  const maxHeight = Math.max(minHeight, openBelow ? belowSpace : aboveSpace);
  const top = openBelow ? belowTop : trigger.top - Math.min(menu.height, maxHeight) - margin;

  positionTopbarFloatingElement(menuElement, left, Math.max(margin, top));
  return Math.round(maxHeight);
}
