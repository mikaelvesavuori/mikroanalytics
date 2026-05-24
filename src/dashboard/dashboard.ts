import { AuthView } from "./authView.js";
import { copyTextToClipboard, downloadTextFile } from "./browserActions.js";
import {
  buildExportRecords,
  exportFilename,
  recordsToCsv,
  recordsToNdjson,
  type ExportFormat,
} from "./exportData.js";
import { CommandPalette } from "./commandPalette.js";
import { requireElement } from "./dom.js";
import { positionAnchoredTopbarMenu, positionSimpleTopbarMenu } from "./floatingMenu.js";
import { formatNumber, formatShortDate } from "./format.js";
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  createDefaultRuntimeConfig,
  loadRuntimeConfig,
} from "./httpClient.js";
import { readListInput } from "./input.js";
import { isEditableTarget, isInteractiveTypingTarget } from "./keyboard.js";
import {
  renderBuckets,
  renderCampaigns,
  renderInstallCheck as renderInstallCheckState,
  setMetricDelta,
  setText,
} from "./renderers.js";
import { siteEditorOptions, siteMenuItem, siteOptions } from "./siteView.js";
import { applyTheme, getPreferredTheme, toggleTheme, type ThemeElements } from "./theme.js";
import { lineTrendElement, trendAxisLabel, trendGap } from "./trendChart.js";
import {
  trendGroupHeading,
  trendLegendItem,
  trendMenuItem,
  trendMenuResetItem,
} from "./trendMenuView.js";
import { readDashboardUrlState, syncDashboardUrlState } from "./urlState.js";
import {
  DEFAULT_TREND_ID,
  MAX_SELECTED_TRENDS,
  PERIOD_PRESETS,
  RANGE_PERIOD_VALUE,
  TOTAL_TRENDS,
  type CollectAttempt,
  type CommandAction,
  type DateRange,
  type Report,
  type RuntimeConfig,
  type Site,
  type TrendCategory,
  type TrendOption,
} from "./model.js";
import { parsePeriodCommand } from "./period.js";
import {
  availableSelectedTrendIds,
  createTrendOptions,
  selectedTrendColor,
} from "./trendOptions.js";

const TREND_SLOT_SELECTOR = ".trend-hit";
const SELECTED_TREND_SLOT_SELECTOR = ".trend-hit.selected";

const siteSelect = requireElement<HTMLSelectElement>("site");
const daysSelect = requireElement<HTMLSelectElement>("days");
const customDaysField = requireElement<HTMLElement>("custom-days-field");
const customDaysInput = requireElement<HTMLInputElement>("custom-days");
const refreshButton = requireElement<HTMLButtonElement>("refresh");
const copySnippetButton = requireElement<HTMLButtonElement>("copy-snippet");
const configureSiteButton = requireElement<HTMLButtonElement>("configure-site");
const shareLinkButton = requireElement<HTMLButtonElement>("share-link");
const exportMenuButton = requireElement<HTMLButtonElement>("export-menu-trigger");
const exportMenuElement = requireElement<HTMLElement>("export-menu");
const exportMenuJsonButton = requireElement<HTMLButtonElement>("export-menu-json");
const exportMenuCsvButton = requireElement<HTMLButtonElement>("export-menu-csv");
const logoutButton = requireElement<HTMLButtonElement>("logout");
const themeToggleButton = requireElement<HTMLButtonElement>("theme-toggle");
const themeIconMoon = requireElement<HTMLElement>("theme-icon-moon");
const themeIconSun = requireElement<HTMLElement>("theme-icon-sun");
const deleteSiteButton = requireElement<HTMLButtonElement>("delete-site");
const newSiteButton = requireElement<HTMLButtonElement>("new-site");
const saveSiteButton = requireElement<HTMLButtonElement>("save-site");
const siteMenuButton = requireElement<HTMLButtonElement>("site-menu-trigger");
const siteMenuElement = requireElement<HTMLElement>("site-menu");
const siteMenuLabelElement = requireElement<HTMLElement>("site-menu-label");
const siteMenuListElement = requireElement<HTMLElement>("site-menu-list");
const siteMenuNewButton = requireElement<HTMLButtonElement>("site-menu-new");
const siteModal = requireElement<HTMLDialogElement>("site-modal");
const siteForm = requireElement<HTMLFormElement>("site-form");
const siteEditorSelect = requireElement<HTMLSelectElement>("site-editor");
const siteIdInput = requireElement<HTMLInputElement>("site-id");
const siteNameInput = requireElement<HTMLInputElement>("site-name");
const siteDomainsInput = requireElement<HTMLInputElement>("site-domains");
const sitePropertiesInput = requireElement<HTMLInputElement>("site-properties");
const statsView = requireElement<HTMLElement>("stats-view");
const trafficEmptyPanel = requireElement<HTMLElement>("traffic-empty");
const trafficEmptyText = requireElement<HTMLElement>("traffic-empty-text");
const trafficEmptyTitle = requireElement<HTMLElement>("traffic-empty-title");
const trendElement = requireElement<HTMLElement>("trend");
const trendLegendElement = requireElement<HTMLElement>("trend-legend");
const trendMenuButton = requireElement<HTMLButtonElement>("trend-menu-trigger");
const trendMenuElement = requireElement<HTMLElement>("trend-menu");
const trendMenuLabelElement = requireElement<HTMLElement>("trend-menu-label");
const trendMenuListElement = requireElement<HTMLElement>("trend-menu-list");
const trendPanel = requireElement<HTMLElement>("trend-panel");
const trendYAxisLabelElement = requireElement<HTMLElement>("trend-y-label");
const detailsGrid = requireElement<HTMLElement>("details-grid");
const configureFromEmptyButton = requireElement<HTMLButtonElement>("configure-from-empty");
const rangeLabelElement = requireElement<HTMLElement>("range-label");
const rangeResetButton = requireElement<HTMLButtonElement>("range-reset");
const installState = requireElement<HTMLElement>("install-state");
const attemptListElement = requireElement<HTMLElement>("attempt-list");
const appShell = requireElement<HTMLElement>("app-shell");
const authPanel = requireElement<HTMLElement>("auth-panel");
const authFields = requireElement<HTMLElement>("auth-fields");
const authForm = requireElement<HTMLFormElement>("auth-form");
const authBackButton = requireElement<HTMLButtonElement>("auth-back");
const authResult = requireElement<HTMLElement>("auth-result");
const authTitle = requireElement<HTMLElement>("auth-title");
const authHelp = requireElement<HTMLElement>("auth-help");
const authResultText = requireElement<HTMLElement>("auth-result-text");
const emailInput = requireElement<HTMLInputElement>("email");
const sendLinkButton = requireElement<HTMLButtonElement>("send-link");
const sendLinkLabel = requireElement<HTMLElement>("send-link-label");
const authStatusElement = requireElement<HTMLElement>("auth-status");
const commandDialog = requireElement<HTMLDialogElement>("command-dialog");
const commandInput = requireElement<HTMLInputElement>("command-input");
const commandList = requireElement<HTMLElement>("command-list");
const shortcutsDialog = requireElement<HTMLDialogElement>("shortcuts-dialog");
const toastRoot = requireElement<HTMLElement>("toast-root");
const authView = new AuthView({
  emailInput,
  fields: authFields,
  help: authHelp,
  result: authResult,
  resultText: authResultText,
  sendLinkButton,
  sendLinkLabel,
  status: authStatusElement,
  title: authTitle,
});
const themeElements: ThemeElements = {
  moonIcon: themeIconMoon,
  sunIcon: themeIconSun,
  toggleButton: themeToggleButton,
};
const commandPalette = new CommandPalette({
  dialog: commandDialog,
  getActions: () => buildCommandActions(),
  getDynamicAction: (input) => (isAuthenticated() ? periodCommandForInput(input) : null),
  input: commandInput,
  list: commandList,
  onError: (error) => showToast(errorMessage(error), "error"),
});
let collectAttempts: CollectAttempt[] = [];
let activeDateRange: DateRange | null = null;
let availableTrendOptions: TrendOption[] = [];
let currentReport: Report | null = null;
let currentTrendSeries: Report["series"] = [];
let editingSiteId = "";
let hasPromptedForFirstSite = false;
let isExportMenuOpen = false;
let isRefreshing = false;
let isSiteMenuOpen = false;
let isTrendMenuOpen = false;
let periodValueBeforeRange = "30";
let pendingUrlSiteId = "";
let pendingTrendIds: string[] = [];
let runtimeConfig = createDefaultRuntimeConfig();
let selectedTrendIds = [DEFAULT_TREND_ID];
let sites: Site[] = [];
let trendSelectionEndIndex: number | null = null;
let trendSelectionStartIndex: number | null = null;

applyTheme(getPreferredTheme(), themeElements);

refreshButton.addEventListener("click", () => void refresh());
shareLinkButton.addEventListener("click", () => void copyDashboardLink());
exportMenuButton.addEventListener("click", (event) => toggleExportMenu(event));
exportMenuElement.addEventListener("click", (event) => event.stopPropagation());
exportMenuJsonButton.addEventListener("click", () => {
  closeExportMenu();
  exportCurrentView("ndjson");
});
exportMenuCsvButton.addEventListener("click", () => {
  closeExportMenu();
  exportCurrentView("csv");
});
logoutButton.addEventListener("click", () => void logout());
themeToggleButton.addEventListener("click", () => toggleTheme(themeElements));
configureSiteButton.addEventListener("click", () => openSiteModal());
siteMenuButton.addEventListener("click", () => toggleSiteMenu());
trendMenuButton.addEventListener("click", () => toggleTrendMenu());
siteMenuNewButton.addEventListener("click", () => {
  closeSiteMenu();
  openSiteModal({ mode: "new" });
});
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Node)) {
    return;
  }

  if (
    !siteMenuElement.hidden &&
    !siteMenuButton.closest("[data-site-menu-root]")?.contains(event.target)
  ) {
    closeSiteMenu();
  }

  if (
    !trendMenuElement.hidden &&
    !trendMenuButton.closest("[data-trend-menu-root]")?.contains(event.target)
  ) {
    closeTrendMenu();
  }

  if (
    !exportMenuElement.hidden &&
    !exportMenuElement.contains(event.target) &&
    !exportMenuButton.contains(event.target)
  ) {
    closeExportMenu();
  }
});
document.addEventListener("keydown", (event) => void handleGlobalKeydown(event));
window.addEventListener("resize", () => {
  positionSiteMenu();
  positionExportMenu();
});
authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void requestMagicLink();
});
authBackButton.addEventListener("click", () => authView.showForm());
configureFromEmptyButton.addEventListener("click", () => openSiteModal());
siteSelect.addEventListener("change", () => {
  renderSiteEditor(currentSite());
  syncSiteEditorSelect(siteSelect.value);
  renderSnippet();
  renderSiteMenu();
  void refreshReport();
});
siteEditorSelect.addEventListener("change", () => {
  const siteId = siteEditorSelect.value;
  renderSiteEditor(currentEditorSite());
  renderSnippet();

  if (!siteId) {
    renderInstallCheck([]);
    syncUrlState();
    return;
  }

  siteSelect.value = siteId;
  renderSiteMenu();
  void refreshReport();
});
daysSelect.addEventListener("change", () => {
  if (daysSelect.value !== RANGE_PERIOD_VALUE) {
    periodValueBeforeRange = daysSelect.value;
  }
  clearActiveDateRange();
  renderPeriodControls();
  void refreshReport();
});
customDaysInput.addEventListener("change", () => {
  periodValueBeforeRange = "custom";
  clearActiveDateRange();
  void refreshReport();
});
deleteSiteButton.addEventListener("click", () => void deleteCurrentSite());
newSiteButton.addEventListener("click", () => {
  startNewSite();
});
siteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveSite();
});
copySnippetButton.addEventListener("click", () => {
  void copyCurrentSnippet();
});
rangeResetButton.addEventListener("click", () => {
  clearActiveDateRange();
  void refreshReport();
});
shortcutsDialog.addEventListener("click", (event) => {
  if (event.target === shortcutsDialog) {
    shortcutsDialog.close();
  }
});
trendElement.addEventListener("pointerdown", (event) => handleTrendPointerDown(event));
trendElement.addEventListener("pointermove", (event) => handleTrendPointerMove(event));
trendElement.addEventListener("pointerup", (event) => handleTrendPointerUp(event));
trendElement.addEventListener("pointercancel", () => clearTrendSelectionPreview());

void boot();

async function handleGlobalKeydown(event: KeyboardEvent): Promise<void> {
  const modifier = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();

  if (modifier && key === "k" && !event.altKey) {
    event.preventDefault();
    if (commandDialog.open) {
      commandPalette.close();
    } else {
      openCommandPalette();
    }
    return;
  }

  if (
    ((modifier && key === "/" && !event.altKey) ||
      key === "?" ||
      (event.shiftKey && key === "/")) &&
    !isEditableTarget(event.target)
  ) {
    event.preventDefault();
    openShortcutsDialog();
    return;
  }

  if (commandDialog.open || shortcutsDialog.open) {
    return;
  }

  if (event.key === "Escape") {
    closeSiteMenu();
    closeTrendMenu();
    closeExportMenu();
    return;
  }

  if (isInteractiveTypingTarget(event.target)) {
    return;
  }

  if (key === "t" && !modifier && !event.altKey) {
    event.preventDefault();
    toggleTheme(themeElements);
    return;
  }

  if (!isAuthenticated()) {
    return;
  }

  if (key === "r" && !modifier && !event.altKey) {
    event.preventDefault();
    await refresh();
    return;
  }

  if (key === "c" && !modifier && !event.altKey) {
    event.preventDefault();
    openSiteModal();
    return;
  }

  if (key === "n" && !modifier && !event.altKey) {
    event.preventDefault();
    openSiteModal({ mode: "new" });
    return;
  }

  if (key === "l" && !modifier && !event.altKey) {
    event.preventDefault();
    await copyDashboardLink();
  }
}

function openCommandPalette(): void {
  closeSiteMenu();
  closeTrendMenu();
  closeExportMenu();
  if (shortcutsDialog.open) {
    shortcutsDialog.close();
  }
  commandPalette.open();
}

function openShortcutsDialog(): void {
  commandPalette.close();
  closeSiteMenu();
  closeTrendMenu();
  closeExportMenu();
  if (!shortcutsDialog.open) {
    shortcutsDialog.showModal();
  }
}

function buildCommandActions(): CommandAction[] {
  const actions: CommandAction[] = [
    {
      detail: "Light or dark mode",
      id: "toggle-theme",
      keywords: "appearance theme light dark",
      run: () => toggleTheme(themeElements),
      shortcut: "T",
      title: `Switch to ${document.documentElement.dataset.theme === "dark" ? "light" : "dark"} mode`,
    },
    {
      detail: "Show keyboard shortcuts",
      id: "shortcuts",
      keywords: "keys help hotkeys",
      run: () => openShortcutsDialog(),
      shortcut: "?",
      title: "Keyboard shortcuts",
    },
  ];

  if (!isAuthenticated()) {
    return actions;
  }

  const site = currentSite();
  const dashboardActions: CommandAction[] = [
    {
      detail: "Reload sites, stats, and install checks",
      id: "refresh",
      keywords: "reload update sync",
      run: () => refresh(),
      shortcut: "R",
      title: "Refresh dashboard",
    },
    {
      detail: site ? `Edit ${site.name || site.id}` : "Create and configure a site",
      id: "configure-site",
      keywords: "settings setup origins install",
      run: () => openSiteModal(),
      shortcut: "C",
      title: site ? "Configure current site" : "Configure site",
    },
    {
      detail: "Create a new analytics site",
      id: "new-site",
      keywords: "add setup domain origin",
      run: () => openSiteModal({ mode: "new" }),
      shortcut: "N",
      title: "New site",
    },
    {
      detail: "Copy a link to the current dashboard view",
      id: "copy-link",
      keywords: "share url permalink",
      run: () => copyDashboardLink(),
      shortcut: "L",
      title: "Copy dashboard link",
    },
  ];

  if (site) {
    dashboardActions.push(
      {
        detail: "Download the current view as newline-delimited JSON",
        id: "export-json",
        keywords: "download export json ndjson data",
        run: () => exportCurrentView("ndjson"),
        title: "Export JSON",
      },
      {
        detail: "Download the current view as CSV",
        id: "export-csv",
        keywords: "download export csv data spreadsheet",
        run: () => exportCurrentView("csv"),
        title: "Export CSV",
      },
    );

    dashboardActions.push({
      detail: "Copy the browser tracker snippet",
      id: "copy-snippet",
      keywords: "install script tracker",
      run: () => copyCurrentSnippet(),
      title: "Copy tracker snippet",
    });
  }

  if (activeDateRange) {
    dashboardActions.push({
      detail: "Return to the selected period preset",
      id: "clear-range",
      keywords: "period dates selection reset",
      run: () => clearDateRangeFromCommand(),
      title: "Clear selected range",
    });
  }

  dashboardActions.push({
    detail: "Return the trend chart to Pageviews",
    id: "reset-trend",
    keywords: "chart metric pagecount page views",
    run: () => resetTrendSelection(),
    title: "Reset trend to Pageviews",
  });

  dashboardActions.push(
    ...PERIOD_PRESETS.map(([days, label]) => ({
      detail: "Update the dashboard period",
      id: `period-${days}`,
      keywords: "period date range",
      run: () => setPeriodPreset(days),
      title: `Show ${label}`,
    })),
  );

  dashboardActions.push(
    ...TOTAL_TRENDS.map((trend) => ({
      detail: "Show this metric in the trend chart",
      id: `trend-${trend.id}`,
      keywords: `chart metric ${trend.key}`,
      run: () => selectSingleTrend(trend.id),
      title: `Trend: ${trend.label}`,
    })),
  );

  dashboardActions.push(
    ...sites.map((entry) => ({
      detail: [entry.id, entry.domains[0]].filter(Boolean).join(" - ") || "Switch site",
      id: `site-${entry.id}`,
      keywords: `site domain origin ${entry.id} ${entry.domains.join(" ")}`,
      run: () => selectSite(entry.id),
      title: `Open site: ${entry.name || entry.id}`,
    })),
  );

  dashboardActions.push({
    detail: "End the current dashboard session",
    id: "logout",
    keywords: "sign out auth session",
    run: () => logout(),
    title: "Sign out",
  });

  return [...dashboardActions, ...actions];
}

function periodCommandForInput(input: string): CommandAction | null {
  const period = parsePeriodCommand(input);
  if (!period) {
    return null;
  }

  if (period.kind === "days") {
    const days = String(period.days);
    const isPreset = PERIOD_PRESETS.some(([presetDays]) => presetDays === days);
    return {
      detail: isPreset ? "Use a dashboard period preset" : "Use a custom dashboard period",
      id: isPreset ? `period-${days}` : `custom-period-${days}`,
      keywords: "custom days period date range",
      run: () => (isPreset ? setPeriodPreset(days) : setCustomPeriodDays(period.days)),
      title: `Show ${formatNumber(period.days)} ${period.days === 1 ? "day" : "days"}`,
    };
  }

  return {
    detail: `${period.range.start} to ${period.range.end}`,
    id: `custom-range-${period.range.start}-${period.range.end}`,
    keywords: "custom date range period",
    run: () => setDateRangeFromCommand(period.range),
    title:
      period.range.start === period.range.end
        ? `Show ${formatShortDate(period.range.start)}`
        : `Show ${formatShortDate(period.range.start)} - ${formatShortDate(period.range.end)}`,
  };
}

function isAuthenticated(): boolean {
  return !appShell.hidden;
}

async function boot(): Promise<void> {
  runtimeConfig = await loadRuntimeConfig();
  applyUrlState();
  await verifyMagicLinkFromUrl();
  await refreshAuth();
}

async function refreshAuth(): Promise<void> {
  try {
    const session = await apiGet<{
      authEnabled: boolean;
      authenticated: boolean;
      user?: { email: string; role: string };
    }>(authRoute("me"));
    setAuthenticated(session.authenticated);

    if (!session.authenticated) {
      authView.setStatus("");
      return;
    }

    await loadSites();
  } catch {
    setAuthenticated(false);
    authView.setStatus("");
  }
}

async function requestMagicLink(): Promise<void> {
  const email = emailInput.value.trim();
  if (!email) {
    authView.setStatus("Enter an email address.", true);
    return;
  }

  authView.setMagicLinkPending(true);
  try {
    await apiPost<{ message?: string }>(authRoute("magicLink"), { email });
    authView.showResult("If this email can sign in, you will receive a link shortly.");
  } catch (error) {
    authView.showResult(errorMessage(error), true);
  } finally {
    authView.setMagicLinkPending(false);
  }
}

async function verifyMagicLinkFromUrl(): Promise<void> {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");

  if (!token || !email) {
    return;
  }

  try {
    await apiPost(authRoute("verify"), { email, token });
    url.searchParams.delete("token");
    url.searchParams.delete("email");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    showToast("Signed in.");
  } catch (error) {
    authView.setStatus(errorMessage(error), true);
  }
}

async function logout(): Promise<void> {
  if (!window.confirm("Sign out of MikroAnalytics?")) {
    return;
  }

  await fetch(authRoute("logout"), { credentials: "same-origin", method: "POST" }).catch(
    () => undefined,
  );
  setAuthenticated(false);
  showToast("Signed out.");
}

async function loadSites(preferredSiteId = pendingUrlSiteId || siteSelect.value): Promise<void> {
  try {
    const data = await apiGet<{ sites: Site[] }>("/api/sites");
    sites = data.sites;
    const nextSiteId = sites.some((site) => site.id === preferredSiteId)
      ? preferredSiteId
      : (sites[0]?.id ?? "");
    pendingUrlSiteId = "";
    siteSelect.replaceChildren(...siteOptions(sites));
    siteEditorSelect.replaceChildren(...siteEditorOptions(sites));
    siteSelect.value = nextSiteId;
    syncSiteEditorSelect(nextSiteId);
    renderSiteEditor(currentSite());
    renderSiteMenu();
    renderSnippet();
    await refreshReport();
    renderView();
    if (!sites.length && !hasPromptedForFirstSite) {
      hasPromptedForFirstSite = true;
      openSiteModal({ mode: "new" });
    }
  } catch (error) {
    showToast(errorMessage(error), "error");
  }
}

async function saveSite(): Promise<void> {
  const payload = {
    allowedEventProperties: readListInput(sitePropertiesInput.value),
    domains: readListInput(siteDomainsInput.value),
    id: siteIdInput.value,
    name: siteNameInput.value,
  };

  saveSiteButton.disabled = true;
  try {
    const response = editingSiteId
      ? await apiPut<{ site: Site }>(`/api/sites/${encodeURIComponent(editingSiteId)}`, payload)
      : await apiPost<{ site: Site }>("/api/sites", payload);
    await loadSites(response.site.id);
    showToast(`Saved ${response.site.name}.`);
  } catch (error) {
    showToast(errorMessage(error), "error");
  } finally {
    saveSiteButton.disabled = false;
  }
}

async function deleteCurrentSite(): Promise<void> {
  const site = currentEditorSite();
  if (!site) {
    return;
  }

  const confirmed = window.confirm(
    `Delete "${site.name}"?\n\nThis removes the site, tracker configuration, and all analytics data stored for it. This cannot be undone.`,
  );
  if (!confirmed) {
    return;
  }

  deleteSiteButton.disabled = true;
  try {
    await apiDelete(`/api/sites/${encodeURIComponent(site.id)}`);
    showToast(`Deleted ${site.name}.`);
    hasPromptedForFirstSite = false;
    await loadSites("");
  } catch (error) {
    showToast(errorMessage(error), "error");
  } finally {
    deleteSiteButton.disabled = false;
  }
}

async function refresh(): Promise<void> {
  if (isRefreshing) {
    return;
  }

  setRefreshPending(true);
  try {
    await refreshAuth();
  } finally {
    setRefreshPending(false);
  }
}

async function refreshReport(
  options: { expectedRange?: DateRange | null; previousRange?: DateRange | null } = {},
): Promise<void> {
  const site = siteSelect.value || sites[0]?.id;
  const expectedRange = options.expectedRange ?? activeDateRange;
  if (!site) {
    collectAttempts = [];
    renderEmptyReport();
    renderInstallCheck([]);
    renderTrafficState(null);
    renderView();
    return;
  }

  try {
    const [report, attemptData] = await Promise.all([
      apiGet<Report>(reportUrl(site)),
      apiGet<{ attempts: CollectAttempt[] }>(
        `/api/collect-attempts?site=${encodeURIComponent(site)}`,
      ).catch(() => ({ attempts: [] })),
    ]);
    if (expectedRange && !reportMatchesRange(report, expectedRange)) {
      throw new Error(rangeMismatchMessage(report, expectedRange));
    }
    collectAttempts = attemptData.attempts;
    renderReport(report);
    renderInstallCheck(collectAttempts);
    renderView();
  } catch (error) {
    if (expectedRange) {
      activeDateRange = options.previousRange ?? null;
      renderRangeControl();
      syncUrlState();
    }
    showToast(errorMessage(error), "error");
  }
}

function renderReport(report: Report): void {
  currentReport = report;
  availableTrendOptions = createTrendOptions(report);
  reconcileSelectedTrends();

  setText("pageviews", formatNumber(report.totals.pageviews));
  setText("events", formatNumber(report.totals.events));
  setText("uniques", formatNumber(report.totals.uniques));
  setMetricDelta(
    "pageviews-delta",
    report.totals.pageviews,
    report.comparison.previous.pageviews,
    report.comparison.delta.pageviews,
  );
  setMetricDelta(
    "events-delta",
    report.totals.events,
    report.comparison.previous.events,
    report.comparison.delta.events,
  );
  setMetricDelta(
    "uniques-delta",
    report.totals.uniques,
    report.comparison.previous.uniques,
    report.comparison.delta.uniques,
  );
  setText("generated", `Updated ${new Date(report.generatedAt).toLocaleString()}`);

  renderTrend(report);
  renderBuckets("pages", report.pages, "No pageviews yet");
  renderBuckets("event-list", report.events, "No events yet");
  renderBuckets("referrers", report.referrers, "No referrers yet");
  renderCampaigns(report.campaigns);
  renderBuckets("devices", report.devices, "No devices yet");
  renderBuckets("browsers", report.browsers, "No browsers yet");
  renderRangeControl();
  renderTrafficState(report);
}

function renderTrend(report: Report): void {
  currentTrendSeries = report.series;
  const selectedTrends = selectedTrendOptions();
  const max = Math.max(
    ...selectedTrends.flatMap((trend) => trend.values.map((point) => point.count)),
    1,
  );
  const midpoint = Math.round(max / 2);
  const firstPoint = report.series[0];
  const lastPoint = report.series.at(-1);
  trendYAxisLabelElement.textContent =
    selectedTrends.length === 1 ? trendAxisLabel(selectedTrends[0]) : "Counts";
  setText("trend-max", formatNumber(max));
  setText("trend-mid", formatNumber(midpoint));
  setText("trend-start", firstPoint ? formatShortDate(firstPoint.date) : "");
  setText("trend-end", lastPoint ? formatShortDate(lastPoint.date) : "");
  trendElement.style.setProperty("--trend-points", String(Math.max(report.series.length, 1)));
  trendElement.style.setProperty("--trend-gap", trendGap(report.series.length));
  trendElement.dataset.mode = "lines";
  trendElement.dataset.density = selectedTrends.length > 4 ? "dense" : "normal";
  trendElement.replaceChildren(lineTrendElement(report.series, selectedTrends, max));
  renderTrendMenu();
  renderTrendLegend();
}

function renderSnippet(): void {
  const site = currentEditorSite();
  setText("snippet", site?.snippet ?? "Create a site to generate a tracker snippet.");
  copySnippetButton.disabled = !site;
}

function renderInstallCheck(attempts: CollectAttempt[]): void {
  renderInstallCheckState(attempts, currentEditorSite(), installState, attemptListElement);
}

function renderTrafficState(report: Report | null): void {
  const hasSite = Boolean(currentSite());
  const hasTraffic = Boolean(report && hasReportTraffic(report));

  if (!hasSite) {
    trafficEmptyTitle.textContent = "No site configured";
    trafficEmptyText.textContent =
      "Create a site, add its allowed origins, then install the tracker snippet.";
  } else {
    trafficEmptyTitle.textContent = "No traffic yet";
    trafficEmptyText.textContent =
      "Install the tracker for this site, then refresh once the first request arrives.";
  }

  trafficEmptyPanel.hidden = hasTraffic;
  trendPanel.hidden = !hasSite || !hasTraffic;
  detailsGrid.hidden = !hasSite || !hasTraffic;
}

function hasReportTraffic(report: Report): boolean {
  return report.totals.pageviews + report.totals.events > 0;
}

function renderView(): void {
  statsView.hidden = false;
  renderSiteMenu();
  syncUrlState();
}

function handleTrendPointerDown(event: PointerEvent): void {
  const index = trendIndexFromEvent(event);
  if (index === null) {
    return;
  }

  trendSelectionStartIndex = index;
  trendSelectionEndIndex = index;
  trendElement.classList.add("selecting");
  trendElement.setPointerCapture(event.pointerId);
  renderTrendSelectionPreview(index, index);
  event.preventDefault();
}

function handleTrendPointerMove(event: PointerEvent): void {
  if (trendSelectionStartIndex === null || !trendElement.hasPointerCapture(event.pointerId)) {
    return;
  }

  const index = trendIndexFromEvent(event);
  if (index === null) {
    return;
  }

  trendSelectionEndIndex = index;
  renderTrendSelectionPreview(trendSelectionStartIndex, index);
}

function handleTrendPointerUp(event: PointerEvent): void {
  if (trendSelectionStartIndex === null) {
    return;
  }

  const endIndex = trendIndexFromEvent(event) ?? trendSelectionEndIndex ?? trendSelectionStartIndex;
  const range = dateRangeFromTrendIndexes(trendSelectionStartIndex, endIndex);
  clearTrendSelectionPreview();

  if (!range) {
    return;
  }

  const previousRange = activeDateRange ? { ...activeDateRange } : null;
  if (!activeDateRange && daysSelect.value !== RANGE_PERIOD_VALUE) {
    periodValueBeforeRange = daysSelect.value;
  }
  activeDateRange = range;
  void refreshReport({ expectedRange: range, previousRange });
}

function trendIndexFromEvent(event: PointerEvent): number | null {
  if (!currentTrendSeries.length) {
    return null;
  }

  const rect = trendElement.getBoundingClientRect();
  if (rect.width <= 0) {
    return null;
  }

  const ratio = Math.min(0.999_999, Math.max(0, (event.clientX - rect.left) / rect.width));
  return Math.min(currentTrendSeries.length - 1, Math.floor(ratio * currentTrendSeries.length));
}

function dateRangeFromTrendIndexes(startIndex: number, endIndex: number): DateRange | null {
  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);
  const startPoint = currentTrendSeries[start];
  const endPoint = currentTrendSeries[end];
  if (!startPoint || !endPoint) {
    return null;
  }

  return { end: endPoint.date, start: startPoint.date };
}

function renderTrendSelectionPreview(startIndex: number, endIndex: number): void {
  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);
  for (const slot of trendElement.querySelectorAll<HTMLElement>(TREND_SLOT_SELECTOR)) {
    const index = Number(slot.dataset.index);
    slot.classList.toggle("selected", index >= start && index <= end);
  }
}

function clearTrendSelectionPreview(): void {
  trendSelectionStartIndex = null;
  trendSelectionEndIndex = null;
  trendElement.classList.remove("selecting");
  for (const slot of trendElement.querySelectorAll<HTMLElement>(SELECTED_TREND_SLOT_SELECTOR)) {
    slot.classList.remove("selected");
  }
}

function clearActiveDateRange(): void {
  activeDateRange = null;
  if (daysSelect.value === RANGE_PERIOD_VALUE) {
    daysSelect.value = periodValueBeforeRange;
  }
  renderPeriodControls();
  renderRangeControl();
}

function renderRangeControl(): void {
  if (!activeDateRange) {
    rangeResetButton.hidden = true;
    rangeLabelElement.textContent = "";
    return;
  }

  daysSelect.value = RANGE_PERIOD_VALUE;
  customDaysField.hidden = true;
  rangeResetButton.hidden = false;
  rangeLabelElement.textContent =
    activeDateRange.start === activeDateRange.end
      ? formatShortDate(activeDateRange.start)
      : `${formatShortDate(activeDateRange.start)} - ${formatShortDate(activeDateRange.end)}`;
}

function reportMatchesRange(report: Report, range: DateRange): boolean {
  return report.range?.start === range.start && report.range?.end === range.end;
}

function rangeMismatchMessage(report: Report, range: DateRange): string {
  const returnedRange = report.range;
  if (!returnedRange?.start || !returnedRange.end) {
    return "The running server does not support selected ranges. Restart MikroAnalytics after rebuilding.";
  }

  return `The running server returned ${formatShortDate(returnedRange.start)} - ${formatShortDate(returnedRange.end)} instead of ${formatShortDate(range.start)} - ${formatShortDate(range.end)}. Restart MikroAnalytics and try again.`;
}

function toggleTrendMenu(): void {
  setTrendMenuOpen(!isTrendMenuOpen);
}

function closeTrendMenu(): void {
  setTrendMenuOpen(false);
}

function setTrendMenuOpen(open: boolean): void {
  isTrendMenuOpen = open;
  trendMenuElement.hidden = !open;
  trendMenuButton.setAttribute("aria-expanded", String(open));

  if (open) {
    closeExportMenu();
  }
}

function renderTrendMenu(): void {
  const selected = selectedTrendOptions();
  trendMenuLabelElement.textContent =
    selected.length === 1 ? (selected[0]?.label ?? "Trend") : `${selected.length} trends`;

  const groups = trendGroups();
  const isDefaultSelection =
    selectedTrendIds.length === 1 && selectedTrendIds[0] === DEFAULT_TREND_ID;
  trendMenuListElement.replaceChildren(
    trendMenuResetItem(isDefaultSelection, resetTrendSelection),
    ...groups.flatMap(([category, trends]) => [
      trendGroupHeading(category),
      ...trends.map((trend) =>
        trendMenuItem(trend, selectedTrendIds.includes(trend.id), () =>
          toggleTrendSelection(trend.id),
        ),
      ),
    ]),
  );
}

function renderTrendLegend(): void {
  const selected = selectedTrendOptions();
  trendLegendElement.replaceChildren(...selected.map(trendLegendItem));
}

function toggleTrendSelection(trendId: string): void {
  if (!availableTrendOptions.some((trend) => trend.id === trendId)) {
    return;
  }

  if (selectedTrendIds.includes(trendId)) {
    if (selectedTrendIds.length === 1) {
      showToast("Keep at least one trend selected.");
      return;
    }
    selectedTrendIds = selectedTrendIds.filter((id) => id !== trendId);
  } else {
    if (selectedTrendIds.length >= MAX_SELECTED_TRENDS) {
      showToast(`Select up to ${MAX_SELECTED_TRENDS} trends at once.`);
      return;
    }
    selectedTrendIds = [...selectedTrendIds, trendId];
  }

  if (currentReport) {
    renderTrend(currentReport);
    syncUrlState();
  }
}

function resetTrendSelection(): void {
  if (!availableTrendOptions.some((trend) => trend.id === DEFAULT_TREND_ID)) {
    return;
  }

  selectedTrendIds = [DEFAULT_TREND_ID];
  pendingTrendIds = [];
  closeTrendMenu();

  if (currentReport) {
    renderTrend(currentReport);
    syncUrlState();
  }
}

function trendGroups(): Array<[TrendCategory, TrendOption[]]> {
  const categories: TrendCategory[] = [
    "totals",
    "pages",
    "events",
    "browsers",
    "devices",
    "campaigns",
  ];
  return categories
    .map(
      (category) =>
        [category, availableTrendOptions.filter((trend) => trend.category === category)] as [
          TrendCategory,
          TrendOption[],
        ],
    )
    .filter(([_category, trends]) => trends.length > 0);
}

function selectedTrendOptions(): TrendOption[] {
  const trendsById = new Map(availableTrendOptions.map((trend) => [trend.id, trend]));
  return selectedTrendIds.flatMap((id, index) => {
    const trend = trendsById.get(id);
    return trend ? [{ ...trend, color: selectedTrendColor(index) }] : [];
  });
}

function reconcileSelectedTrends(): void {
  const availableIds = new Set(availableTrendOptions.map((trend) => trend.id));
  const requestedIds = pendingTrendIds.length ? pendingTrendIds : selectedTrendIds;
  const nextIds = requestedIds.filter((id) => availableIds.has(id)).slice(0, MAX_SELECTED_TRENDS);

  selectedTrendIds = nextIds.length
    ? nextIds
    : availableIds.has(DEFAULT_TREND_ID)
      ? [DEFAULT_TREND_ID]
      : availableTrendOptions.slice(0, 1).map((trend) => trend.id);
  pendingTrendIds = [];
  selectedTrendIds = availableSelectedTrendIds(availableTrendOptions, selectedTrendIds);
}

function toggleSiteMenu(): void {
  setSiteMenuOpen(!isSiteMenuOpen);
}

function closeSiteMenu(): void {
  setSiteMenuOpen(false);
}

function setSiteMenuOpen(open: boolean): void {
  isSiteMenuOpen = open;
  siteMenuElement.hidden = !open;
  siteMenuButton.setAttribute("aria-expanded", String(open));

  if (open) {
    closeExportMenu();
    positionSiteMenu();
    window.requestAnimationFrame(positionSiteMenu);
  }
}

function renderSiteMenu(): void {
  const site = currentSite();
  const title = site ? site.name || site.domains[0] || site.id : "No site";
  siteMenuLabelElement.textContent = title;
  siteMenuButton.title = title;
  siteMenuListElement.replaceChildren(
    ...sites.map((site) =>
      siteMenuItem(site, siteSelect.value, () => {
        void selectSite(site.id);
      }),
    ),
  );
  siteMenuButton.disabled = false;
  siteMenuNewButton.disabled = false;

  if (isSiteMenuOpen && siteMenuElement.hidden) {
    setSiteMenuOpen(true);
  }
  positionSiteMenu();
}

function positionSiteMenu(): void {
  if (siteMenuElement.hidden) {
    return;
  }

  const maxHeight = positionAnchoredTopbarMenu(siteMenuElement, siteMenuButton);
  siteMenuElement.style.maxHeight = `${maxHeight}px`;
}

async function selectSite(siteId: string): Promise<void> {
  if (!sites.some((site) => site.id === siteId)) {
    return;
  }

  siteSelect.value = siteId;
  syncSiteEditorSelect(siteId);
  renderSiteEditor(currentSite());
  renderSnippet();
  renderSiteMenu();
  closeSiteMenu();
  await refreshReport();
}

function openSiteModal(options: { mode?: "current" | "new" } = {}): void {
  closeSiteMenu();
  closeExportMenu();
  if (options.mode === "new" || !currentSite()) {
    startNewSite();
  } else {
    syncSiteEditorSelect(siteSelect.value);
    renderSiteEditor(currentSite());
    renderSnippet();
    renderInstallCheck(collectAttempts);
  }

  if (!siteModal.open) {
    siteModal.showModal();
  }
}

function startNewSite(): void {
  siteEditorSelect.value = "";
  renderSiteEditor(null);
  renderSnippet();
  renderInstallCheck([]);
}

function renderSiteEditor(site: Site | null): void {
  editingSiteId = site?.id ?? "";
  deleteSiteButton.disabled = !site;
  siteIdInput.disabled = Boolean(site);
  siteIdInput.value = site?.id ?? "";
  siteNameInput.value = site?.name ?? "";
  siteDomainsInput.value = site?.domains.join(", ") ?? "";
  sitePropertiesInput.value = site?.allowedEventProperties.join(", ") ?? "";
  saveSiteButton.textContent = site ? "Save site" : "Create site";
}

function renderEmptyReport(): void {
  renderReport({
    browsers: [],
    campaigns: [],
    comparison: {
      delta: { events: 0, pageviews: 0, uniques: 0 },
      previous: { events: 0, pageviews: 0, uniques: 0 },
    },
    devices: [],
    events: [],
    generatedAt: new Date().toISOString(),
    pages: [],
    range: {
      days: 0,
      end: "",
      start: "",
    },
    referrers: [],
    series: [],
    totals: { events: 0, pageviews: 0, uniques: 0 },
    trends: [],
  });
  setText("generated", "");
}

function currentSite(): Site | null {
  return sites.find((candidate) => candidate.id === siteSelect.value) ?? sites[0] ?? null;
}

function currentEditorSite(): Site | null {
  return sites.find((candidate) => candidate.id === siteEditorSelect.value) ?? null;
}

function syncSiteEditorSelect(siteId: string): void {
  siteEditorSelect.value = sites.some((site) => site.id === siteId) ? siteId : "";
}

function renderPeriodControls(): void {
  customDaysField.hidden = daysSelect.value !== "custom";
}

function selectedPeriodDays(): string {
  if (daysSelect.value === RANGE_PERIOD_VALUE) {
    return periodValueBeforeRange === "custom" ? customDaysInput.value : periodValueBeforeRange;
  }

  if (daysSelect.value !== "custom") {
    return daysSelect.value;
  }

  const parsed = Number(customDaysInput.value);
  const days = Number.isFinite(parsed) ? Math.min(730, Math.max(1, Math.floor(parsed))) : 30;
  customDaysInput.value = String(days);
  return String(days);
}

function reportUrl(siteId: string): string {
  const params = new URLSearchParams({ site: siteId });
  if (activeDateRange) {
    params.set("start", activeDateRange.start);
    params.set("end", activeDateRange.end);
  } else {
    params.set("days", selectedPeriodDays());
  }

  return `/api/report?${params.toString()}`;
}

function applyUrlState(): void {
  const state = readDashboardUrlState();

  if (state.siteId) {
    pendingUrlSiteId = state.siteId;
  }

  if (state.trendIds.length) {
    pendingTrendIds = state.trendIds;
  }

  activeDateRange = state.range;
  applyUrlPeriod(state.days);
}

function applyUrlPeriod(value: string | null): void {
  if (!value) {
    renderPeriodControls();
    return;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    renderPeriodControls();
    return;
  }

  const days = String(Math.min(730, Math.max(1, Math.floor(parsed))));
  if (PERIOD_PRESETS.some(([presetDays]) => presetDays === days)) {
    daysSelect.value = days;
  } else {
    daysSelect.value = "custom";
    customDaysInput.value = days;
  }
  periodValueBeforeRange = daysSelect.value;
  if (activeDateRange) {
    daysSelect.value = RANGE_PERIOD_VALUE;
  }
  renderPeriodControls();
}

function syncUrlState(): string {
  return syncDashboardUrlState({
    days: selectedPeriodDays(),
    range: activeDateRange,
    siteId: selectedUrlSiteId(),
    trendIds: selectedTrendIds,
  });
}

function selectedUrlSiteId(): string {
  return siteSelect.value;
}

async function copyDashboardLink(): Promise<void> {
  const url = syncUrlState();
  await copyTextToClipboard(
    url,
    "Dashboard link copied.",
    showToast,
    "Link is in the address bar.",
  );
}

async function copyCurrentSnippet(): Promise<void> {
  const snippet = requireElement("snippet").textContent ?? "";
  await copyTextToClipboard(snippet, "Snippet copied.", showToast);
}

function exportCurrentView(format: ExportFormat): void {
  const report = currentReport;
  const site = currentSite();
  if (!report || !site) {
    showToast("Load a site before exporting.", "error");
    return;
  }

  const records = buildExportRecords({
    period: activeDateRange ? "selected_range" : `${selectedPeriodDays()} days`,
    report,
    selectedTrends: selectedTrendOptions(),
    site,
    url: syncUrlState(),
  });
  const content = format === "csv" ? recordsToCsv(records) : recordsToNdjson(records);
  const extension = format === "csv" ? "csv" : "ndjson";
  const mime = format === "csv" ? "text/csv;charset=utf-8" : "application/x-ndjson;charset=utf-8";

  downloadTextFile(exportFilename(site, report, extension), content, mime);
  showToast(`Exported ${format === "csv" ? "CSV" : "JSON"}.`);
}

async function clearDateRangeFromCommand(): Promise<void> {
  if (!activeDateRange) {
    return;
  }

  clearActiveDateRange();
  await refreshReport();
}

async function setPeriodPreset(days: string): Promise<void> {
  activeDateRange = null;
  daysSelect.value = days;
  periodValueBeforeRange = days;
  renderPeriodControls();
  renderRangeControl();
  await refreshReport();
}

async function setCustomPeriodDays(days: number): Promise<void> {
  const normalizedDays = String(Math.min(730, Math.max(1, Math.floor(days))));
  activeDateRange = null;
  if (PERIOD_PRESETS.some(([presetDays]) => presetDays === normalizedDays)) {
    daysSelect.value = normalizedDays;
    periodValueBeforeRange = normalizedDays;
  } else {
    daysSelect.value = "custom";
    customDaysInput.value = normalizedDays;
    periodValueBeforeRange = "custom";
  }
  renderPeriodControls();
  renderRangeControl();
  await refreshReport();
}

async function setDateRangeFromCommand(range: DateRange): Promise<void> {
  const previousRange = activeDateRange ? { ...activeDateRange } : null;
  if (!activeDateRange && daysSelect.value !== RANGE_PERIOD_VALUE) {
    periodValueBeforeRange = daysSelect.value;
  }
  activeDateRange = range;
  await refreshReport({ expectedRange: range, previousRange });
}

function selectSingleTrend(trendId: string): void {
  if (!availableTrendOptions.some((trend) => trend.id === trendId)) {
    return;
  }

  selectedTrendIds = [trendId];
  pendingTrendIds = [];
  closeTrendMenu();

  if (currentReport) {
    renderTrend(currentReport);
    syncUrlState();
  }
}

function authRoute(name: keyof RuntimeConfig["auth"]["routes"]): string {
  return runtimeConfig.auth.routes[name];
}

function setAuthenticated(authenticated: boolean): void {
  appShell.hidden = !authenticated;
  authPanel.hidden = authenticated;
  if (!authenticated) {
    if (siteModal.open) {
      siteModal.close();
    }
    commandPalette.close();
    if (shortcutsDialog.open) {
      shortcutsDialog.close();
    }
    closeSiteMenu();
    closeExportMenu();
    authView.showForm();
  }
  for (const element of document.querySelectorAll<HTMLElement>(".requires-auth")) {
    element.hidden = !authenticated;
  }
  siteSelect.disabled = !authenticated;
  siteMenuButton.disabled = !authenticated;
  siteMenuNewButton.disabled = !authenticated;
  siteEditorSelect.disabled = !authenticated;
  daysSelect.disabled = !authenticated;
  customDaysInput.disabled = !authenticated;
  refreshButton.disabled = false;
  configureSiteButton.disabled = !authenticated;
  shareLinkButton.disabled = !authenticated;
  exportMenuButton.disabled = !authenticated;
  exportMenuJsonButton.disabled = !authenticated;
  exportMenuCsvButton.disabled = !authenticated;
  logoutButton.disabled = !authenticated;
  deleteSiteButton.disabled = !authenticated || !currentEditorSite();
  newSiteButton.disabled = !authenticated;
  saveSiteButton.disabled = !authenticated;
}

function setRefreshPending(pending: boolean): void {
  isRefreshing = pending;
  refreshButton.disabled = pending;
  refreshButton.dataset.loading = String(pending);
  refreshButton.setAttribute("aria-busy", String(pending));
  refreshButton.setAttribute("aria-label", pending ? "Refreshing dashboard" : "Refresh dashboard");
  refreshButton.title = pending ? "Refreshing..." : "Refresh dashboard";
}

function showToast(message: string, tone: "default" | "error" = "default"): void {
  if (!message) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = tone === "error" ? "toast is-error" : "toast";
  toast.textContent = message;
  toastRoot.append(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

function toggleExportMenu(event: MouseEvent): void {
  event.stopPropagation();
  setExportMenuOpen(!isExportMenuOpen);
}

function closeExportMenu(): void {
  setExportMenuOpen(false);
}

function setExportMenuOpen(open: boolean): void {
  isExportMenuOpen = open;
  exportMenuElement.hidden = !open;
  exportMenuButton.setAttribute("aria-expanded", String(open));

  if (open) {
    closeSiteMenu();
    closeTrendMenu();
    positionExportMenu();
    window.requestAnimationFrame(positionExportMenu);
  }
}

function positionExportMenu(): void {
  if (exportMenuElement.hidden) {
    return;
  }

  positionSimpleTopbarMenu(exportMenuElement, exportMenuButton);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
