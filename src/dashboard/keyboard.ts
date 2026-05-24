export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function isInteractiveTypingTarget(target: EventTarget | null): boolean {
  return (
    isEditableTarget(target) ||
    (target instanceof HTMLElement &&
      Boolean(target.closest("button, [role='button'], [role='menuitem'], [role='option']")))
  );
}
