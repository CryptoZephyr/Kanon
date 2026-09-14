const UPSTREAM_ORIGIN =
  process.env.KANON_API_ORIGIN ?? "https://kanon-api.onrender.com";

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
  "x-kanon-company-token",
];

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

export default {
  async fetch(request: Request): Promise<Response> {
    const companyToken = process.env.KANON_COMPANY_API_TOKEN;
    if (!companyToken) {
      return errorResponse(500, "SERVER_MISCONFIGURED");
    }

    const requestUrl = new URL(request.url);
    const query = new URLSearchParams(requestUrl.searchParams);
    query.delete("__kanon_path");
    const queryString = query.toString();
    const upstreamUrl = new URL(
      `${forwardedPath(requestUrl)}${queryString ? `?${queryString}` : ""}`,
      UPSTREAM_ORIGIN,
    );
    const headers = new Headers(request.headers);
    for (const name of HOP_BY_HOP_HEADERS) {
      headers.delete(name);
    }
    headers.set("x-kanon-company-token", companyToken);

    let body: ArrayBuffer | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = await request.arrayBuffer();
    }

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body,
        redirect: "manual",
      });
    } catch {
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
