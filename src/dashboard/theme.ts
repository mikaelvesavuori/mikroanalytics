import type { ThemePreference } from "./model.js";

const THEME_STORAGE_KEY = "mikroanalytics_theme";
const THEME_COLORS: Record<ThemePreference, string> = {
  dark: "#0b0d10",
  light: "#f4f6f9",
};

export interface ThemeElements {
  moonIcon: HTMLElement;
  sunIcon: HTMLElement;
  toggleButton: HTMLButtonElement;
}

export function getPreferredTheme(): ThemePreference {
  try {
    const savedTheme = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      return savedTheme;
    }
  } catch {
    return "light";
  }

  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function toggleTheme(elements: ThemeElements): ThemePreference {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const nextTheme = currentTheme === "dark" ? "light" : "dark";

  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Theme still changes for this session when storage is unavailable.
  }

  applyTheme(nextTheme, elements);
  return nextTheme;
}

export function applyTheme(theme: ThemePreference, elements: ThemeElements): void {
  document.documentElement.dataset.theme = theme;
  const nextTheme = theme === "dark" ? "light" : "dark";
  elements.sunIcon.toggleAttribute("hidden", theme !== "dark");
  elements.moonIcon.toggleAttribute("hidden", theme !== "light");
  elements.toggleButton.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  elements.toggleButton.title = `Switch to ${nextTheme} mode`;
  document
    .querySelector<HTMLMetaElement>("#theme-color")
    ?.setAttribute("content", THEME_COLORS[theme]);
}
