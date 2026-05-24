import { createReadStream, existsSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";

export async function readJson<T>(request: IncomingMessage, maxBytes = 32_768): Promise<T> {
  const chunks: Buffer[] = [];
  let bytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;

    if (bytes > maxBytes) {
      throw new HttpError(413, "Payload is too large.");
    }

    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  if (!body.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function sendJson(
  response: ServerResponse,
  statusCode: number,
  data: unknown,
  headers: Record<string, string> = {},
): void {
  const body = JSON.stringify(data);
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(body);
}

export function sendNoContent(response: ServerResponse, statusCode = 204): void {
  response.writeHead(statusCode, { "Cache-Control": "no-store" });
  response.end();
}

export function applyCors(response: ServerResponse): void {
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-MikroAnalytics-Token",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Max-Age", "600");
}

export function serveStatic(root: string, requestPath: string, response: ServerResponse): boolean {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = normalize(join(root, safePath));
  const normalizedRoot = normalize(root);

  if (
    !filePath.startsWith(normalizedRoot) ||
    !existsSync(filePath) ||
    !statSync(filePath).isFile()
  ) {
    return false;
  }

  response.writeHead(200, {
    "Cache-Control": filePath.endsWith("m.js") ? "public, max-age=3600" : "no-store",
    "Content-Type": contentType(filePath),
  });
  createReadStream(filePath).pipe(response);
  return true;
}

export function requireBearerToken(
  request: IncomingMessage,
  response: ServerResponse,
  expectedToken: string,
): boolean {
  if (!expectedToken) {
    sendJson(response, 500, { error: "Admin token is not configured." });
    return false;
  }

  const header = request.headers.authorization ?? "";
  const providedToken = Array.isArray(header) ? header[0] : header;
  if (providedToken !== `Bearer ${expectedToken}`) {
    sendJson(response, 401, { error: "Unauthorized." });
    return false;
  }

  return true;
}

export function getHeader(request: IncomingMessage, name: string): string {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
