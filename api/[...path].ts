import type { IncomingMessage, ServerResponse } from "node:http";

type ParsedBody =
  | ArrayBuffer
  | Buffer
  | Record<string, unknown>
  | string
  | Uint8Array
  | null
  | undefined;

interface VercelRequest extends IncomingMessage {
  body?: ParsedBody;
}

interface VercelResponse extends ServerResponse {
  json(payload: unknown): VercelResponse;
}

const UPSTREAM_ORIGIN =
  process.env.KANON_API_ORIGIN ?? "https://kanon-api.onrender.com";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
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
]);

function writeError(
  response: VercelResponse,
  statusCode: number,
  code: string,
): void {
  response.statusCode = statusCode;
  response.setHeader("cache-control", "no-store");
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify({
      schema: "kanon.api.error",
      version: 1,
      code,
    }),
  );
}

function serializeBody(body: ParsedBody): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === "string" || body instanceof ArrayBuffer) {
    return body;
  }
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    return new Uint8Array(body);
  }
  return JSON.stringify(body);
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  const companyToken = process.env.KANON_COMPANY_API_TOKEN;
  if (!companyToken) {
    writeError(response, 500, "SERVER_MISCONFIGURED");
    return;
  }

  const requestUrl = new URL(request.url ?? "/api", "https://kanon.vercel.app");
  const upstreamPath = requestUrl.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  const upstreamUrl = new URL(
    `${upstreamPath}${requestUrl.search}`,
    UPSTREAM_ORIGIN,
  );
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (HOP_BY_HOP_HEADERS.has(name) || value === undefined) {
      continue;
    }
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  headers.set("x-kanon-company-token", companyToken);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : serializeBody(request.body),
      redirect: "manual",
    });
  } catch {
    writeError(response, 502, "UPSTREAM_REQUEST_FAILED");
    return;
  }

  const responseBody = Buffer.from(await upstream.arrayBuffer());
  response.statusCode = upstream.status;
  upstream.headers.forEach((value, name) => {
    if (!HOP_BY_HOP_HEADERS.has(name)) {
      response.setHeader(name, value);
    }
  });
  response.setHeader("content-length", responseBody.byteLength);
  response.end(responseBody);
}
