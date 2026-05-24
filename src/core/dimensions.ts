export interface ClientDimensions {
  browser: string;
  device: string;
  os: string;
}

export function parseUserAgent(userAgent: string): ClientDimensions {
  const source = userAgent.toLowerCase();

  return {
    browser: parseBrowser(source),
    device: parseDevice(source),
    os: parseOs(source),
  };
}

function parseBrowser(source: string): string {
  if (source.includes("edg/")) return "Edge";
  if (source.includes("opr/") || source.includes("opera")) return "Opera";
  if (source.includes("firefox/")) return "Firefox";
  if (source.includes("chrome/") || source.includes("chromium/")) return "Chrome";
  if (source.includes("safari/")) return "Safari";
  return "Other";
}

function parseDevice(source: string): string {
  if (source.includes("ipad") || source.includes("tablet")) return "Tablet";
  if (source.includes("mobi") || source.includes("iphone") || source.includes("android")) {
    return "Mobile";
  }
  return "Desktop";
}

function parseOs(source: string): string {
  if (source.includes("android")) return "Android";
  if (source.includes("iphone") || source.includes("ipad") || source.includes("ios")) return "iOS";
  if (source.includes("mac os") || source.includes("macintosh")) return "macOS";
  if (source.includes("windows")) return "Windows";
  if (source.includes("linux")) return "Linux";
  return "Other";
}
