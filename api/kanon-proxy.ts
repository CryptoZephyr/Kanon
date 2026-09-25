const UPSTREAM_ORIGIN =
  process.env.KANON_API_ORIGIN ?? "https://kanon-api.onrender.com";
const MAX_BODY_BYTES = 64 * 1024;
const UPSTREAM_TIMEOUT_MS = 110_000;

const HOP_BY_HOP_HEADERS = [
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

const STRIPPED_HEADERS = [
  ...HOP_BY_HOP_HEADERS,
  "x-kanon-company-token",
  "x-kanon-demo-token",
  "x-kanon-client-ip",
  "x-runner-shared-secret",
];

const PROXY_READ_PATHS = [
  /^\/healthz$/,
  /^\/v1\/status$/,
  /^\/v1\/proof\/latest$/,
  /^\/v1\/proof\/runs\/[^/]+$/,
  /^\/v1\/organizations\/[^/]+$/,
  /^\/v1\/organizations\/[^/]+\/wallet$/,
  /^\/v1\/organizations\/[^/]+\/agents\/[^/]+$/,
  /^\/v1\/organizations\/[^/]+\/installations$/,
  /^\/v1\/organizations\/[^/]+\/installations\/[^/]+$/,
  /^\/v1\/organizations\/[^/]+\/installations\/[^/]+\/(?:update-diff|evidence)$/,
];

const PROXY_MUTATION_PATHS = [
  /^\/v1\/organizations\/[^/]+\/agents\/[^/]+\/releases$/,
  /^\/v1\/organizations\/[^/]+\/installations\/[^/]+\/(?:company-terms|approval|executions|revoke|reject-update)$/,
];

export function isAllowedProxyRequest(method: string, path: string): boolean {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD") {
    return PROXY_READ_PATHS.some((pattern) => pattern.test(path));
  }
  if (normalizedMethod === "POST") {
    return PROXY_MUTATION_PATHS.some((pattern) => pattern.test(path));
  }
  return false;
}

export function buildUpstreamHeaders(
  incoming: Headers,
  options: { readonly demoToken: string; readonly clientIp: string },
): Headers {
  const headers = new Headers(incoming);
  for (const name of STRIPPED_HEADERS) {
    headers.delete(name);
  }
  headers.set("x-kanon-demo-token", options.demoToken);
  headers.set("x-kanon-client-ip", options.clientIp);
  return headers;
}

function errorResponse(status: number, code: string): Response {
  return new Response(
    JSON.stringify({
      schema: "kanon.api.error",
      version: 1,
      code,
    }),
    {
      status,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}

function forwardedPath(requestUrl: URL): string {
  const value = requestUrl.searchParams.get("__kanon_path");
  if (!value || value === "/") return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

export default {
  async fetch(request: Request): Promise<Response> {
    const demoToken = process.env.KANON_DEMO_API_TOKEN;
    if (!demoToken) {
      return errorResponse(500, "SERVER_MISCONFIGURED");
    }

    const requestUrl = new URL(request.url);
    const path = forwardedPath(requestUrl);
    if (!isAllowedProxyRequest(request.method, path)) {
      return errorResponse(403, "FORBIDDEN");
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return errorResponse(413, "REQUEST_TOO_LARGE");
    }

    const query = new URLSearchParams(requestUrl.searchParams);
    query.delete("__kanon_path");
    const queryString = query.toString();
    const upstreamUrl = new URL(
      `${path}${queryString ? `?${queryString}` : ""}`,
      UPSTREAM_ORIGIN,
    );
    const headers = buildUpstreamHeaders(request.headers, {
      demoToken,
      clientIp: clientIp(request),
    });

    let body: ArrayBuffer | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = await request.arrayBuffer();
      if (body.byteLength > MAX_BODY_BYTES) {
        return errorResponse(413, "REQUEST_TOO_LARGE");
      }
    }

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        return errorResponse(504, "UPSTREAM_TIMEOUT");
      }
      return errorResponse(502, "UPSTREAM_REQUEST_FAILED");
    }

    const responseHeaders = new Headers(upstream.headers);
    for (const name of HOP_BY_HOP_HEADERS) {
      responseHeaders.delete(name);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};
