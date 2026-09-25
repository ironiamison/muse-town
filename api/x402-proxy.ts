import { lookup } from "node:dns/promises";
import { Agent, request as httpRequest, type Dispatcher } from "undici";
import ipaddr from "ipaddr.js";

type ApiRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  send: (body: Buffer | string) => void;
  end: () => void;
};

const MAX_BODY = 1_000_000;
const PAYMENT_REQUEST = ["payment-signature", "x-payment"] as const;
const PAYMENT_REQUIRED = ["payment-required", "x-payment-required"] as const;
const PAYMENT_RESPONSE = ["payment-response", "x-payment-response"] as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function fail(response: ApiResponse, status: number, code: string, message: string) {
  response.status(status).json({ ok: false, error: { code, message } });
}

function isPrivateIp(address: string) {
  if (!ipaddr.isValid(address)) return true;
  let parsed = ipaddr.parse(address);
  if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
    parsed = parsed.toIPv4Address();
  }
  return parsed.range() !== "unicast";
}

async function safeTarget(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("A complete HTTPS resource URL is required.");
  }
  if (url.protocol !== "https:") throw new Error("Only HTTPS x402 resources are allowed.");
  if (url.username || url.password) throw new Error("Credentials are not allowed in the resource URL.");
  if (url.port && url.port !== "443") throw new Error("Only the standard HTTPS port is allowed.");
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) {
    throw new Error("The resource hostname does not resolve exclusively to public addresses.");
  }
  return { url, records };
}

function header(headers: Record<string, string | string[] | undefined>, names: readonly string[]) {
  for (const name of names) {
    const value = first(headers[name]) || first(headers[name.toLowerCase()]);
    if (value) return value;
  }
  return "";
}

function upstreamHeader(headers: Record<string, string | string[] | undefined>, names: readonly string[]) {
  for (const name of names) {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) return value[0] || "";
    if (value) return String(value);
  }
  return "";
}

/**
 * Narrow x402 relay for browser clients.
 *
 * It is deliberately not a generic fetch proxy:
 * - HTTPS GET only, credentials stripped, redirects refused
 * - DNS is resolved once, private/reserved ranges rejected, and the HTTP
 *   connection is pinned to that validated result (prevents DNS rebinding)
 * - unpaid non-402 bodies and paid bodies without PAYMENT-RESPONSE are refused
 * - response body capped at 1 MB
 */
export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Access-Control-Allow-Origin", "https://musetools.fun");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Payment-Signature, X-Payment");
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method !== "GET") {
    fail(response, 405, "METHOD_NOT_ALLOWED", "The x402 browser relay accepts GET resources only.");
    return;
  }
  const raw = first(request.query.url) || "";
  if (!raw || raw.length > 2_000) {
    fail(response, 400, "INVALID_RESOURCE_URL", "Pass one HTTPS resource URL no longer than 2,000 characters.");
    return;
  }

  let target: Awaited<ReturnType<typeof safeTarget>>;
  try {
    target = await safeTarget(raw);
  } catch (error) {
    fail(response, 400, "UNSAFE_RESOURCE_URL", error instanceof Error ? error.message : "The resource URL is not allowed.");
    return;
  }

  const paymentSignature = header(request.headers, PAYMENT_REQUEST);
  const records = target.records;
  let cursor = 0;
  const dispatcher = new Agent({
    connect: {
      servername: target.url.hostname,
      lookup: (_hostname, options, callback) => {
        if (options.all) {
          callback(null, records);
          return;
        }
        const record = records[cursor++ % records.length];
        callback(null, record.address, record.family);
      },
    },
  });

  try {
    const upstream = await httpRequest(target.url, {
      method: "GET",
      dispatcher,
      headersTimeout: 12_000,
      bodyTimeout: 15_000,
      headers: {
        accept: "application/json, text/plain;q=0.9, */*;q=0.5",
        "user-agent": "MuseTools-x402/1",
        ...(paymentSignature
          ? request.headers["payment-signature"]
            ? { "payment-signature": paymentSignature }
            : { "x-payment": paymentSignature }
          : {}),
      },
    });
    const required = upstreamHeader(upstream.headers, PAYMENT_REQUIRED);
    const receipt = upstreamHeader(upstream.headers, PAYMENT_RESPONSE);
    const location = upstreamHeader(upstream.headers, ["location"]);
    if (upstream.statusCode >= 300 && upstream.statusCode < 400) {
      await upstream.body.dump({ limit: MAX_BODY });
      fail(response, 502, "REDIRECT_REFUSED", `The provider redirected the resource${location ? ` to ${location}` : ""}. Use the final HTTPS URL.`);
      return;
    }
    if (!paymentSignature && (upstream.statusCode !== 402 || !required)) {
      await upstream.body.dump({ limit: MAX_BODY });
      fail(response, 422, "NOT_X402", `The provider returned HTTP ${upstream.statusCode} without an x402 PAYMENT-REQUIRED offer.`);
      return;
    }
    if (paymentSignature && !receipt) {
      await upstream.body.dump({ limit: MAX_BODY });
      fail(response, 502, "NO_PAYMENT_RECEIPT", `The provider returned HTTP ${upstream.statusCode} without PAYMENT-RESPONSE. No resource body was relayed.`);
      return;
    }
    const declaredLength = Number(upstreamHeader(upstream.headers, ["content-length"]));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY) {
      await upstream.body.dump({ limit: MAX_BODY });
      fail(response, 413, "RESOURCE_TOO_LARGE", "The paid resource exceeds the 1 MB browser-relay limit.");
      return;
    }
    const chunks: Buffer[] = [];
    let byteLength = 0;
    for await (const chunk of upstream.body) {
      const bytes = Buffer.from(chunk);
      byteLength += bytes.byteLength;
      if (byteLength > MAX_BODY) {
        upstream.body.destroy();
        fail(response, 413, "RESOURCE_TOO_LARGE", "The paid resource exceeds the 1 MB browser-relay limit.");
        return;
      }
      chunks.push(bytes);
    }
    const bytes = Buffer.concat(chunks, byteLength);
    if (required) response.setHeader("Payment-Required", required);
    if (receipt) response.setHeader("Payment-Response", receipt);
    response.setHeader("Content-Type", upstreamHeader(upstream.headers, ["content-type"]) || "application/octet-stream");
    response.status(upstream.statusCode).send(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The provider could not be reached.";
    fail(response, 502, "PROVIDER_UNREACHABLE", message);
  } finally {
    await (dispatcher as Dispatcher & { close: () => Promise<void> }).close();
  }
}
