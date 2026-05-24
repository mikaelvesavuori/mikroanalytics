import type { Site } from "./model.js";

export function siteMenuItem(
  site: Site,
  activeSiteId: string,
  onSelect: () => void,
): HTMLButtonElement {
  const item = document.createElement("button");
  item.className = site.id === activeSiteId ? "site-menu-item active" : "site-menu-item";
  item.type = "button";
  item.setAttribute("role", "menuitem");
  item.setAttribute("aria-current", String(site.id === activeSiteId));

  const text = document.createElement("span");
  const name = document.createElement("strong");
  const meta = document.createElement("small");
  name.textContent = site.name || site.id;
  meta.textContent = [site.id, site.domains[0]].filter(Boolean).join(" · ");
  text.append(name, meta);

  item.append(text);
  item.addEventListener("click", onSelect);
  return item;
}

export function siteOptions(sites: Site[]): HTMLOptionElement[] {
  if (!sites.length) {
    return [new Option("No sites", "", false, false)];
  }

  return sites.map((site) => new Option(site.name || site.id, site.id, false, false));
}

export function siteEditorOptions(sites: Site[]): HTMLOptionElement[] {
  const options = [new Option("New site", "", false, false)];
  options.push(
    ...sites.map((site) => new Option(`${site.name} (${site.id})`, site.id, false, false)),
  );
  return options;
}
