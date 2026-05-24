export async function copyTextToClipboard(
  text: string,
  successMessage: string,
  showToast: (message: string, tone?: "default" | "error") => void,
  fallbackMessage = "Clipboard is unavailable.",
): Promise<void> {
  if (!text) {
    return;
  }

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage);
      return;
    } catch {
      // Fall through to the selection-based copy path used by local HTTP previews.
    }
  }

  if (copyTextWithSelection(text)) {
    showToast(successMessage);
    return;
  }

  showToast(fallbackMessage, fallbackMessage === "Clipboard is unavailable." ? "error" : "default");
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function copyTextWithSelection(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.left = "0";
  field.style.opacity = "0";
  field.style.pointerEvents = "none";
  document.body.append(field);
  field.focus();
  field.select();
  field.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
  }
}
