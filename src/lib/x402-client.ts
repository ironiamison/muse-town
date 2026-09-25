import { x402Client } from "@x402/core/client";
import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from "@x402/core/http";
import type { PaymentRequired, PaymentRequirements } from "@x402/core/types";
import { findDefaultAsset } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { createWalletClient, custom, getAddress } from "viem";
import type { WalletSession } from "./wallet";

/**
 * MuseTools is an x402 buyer, not a seller. A connected wallet signs a payment
 * directly to the payTo address advertised by the resource. MuseTools never
 * receives a private key, receives funds, or proxies arbitrary paid requests.
 */

export const X402_MAX_PER_PAYMENT = "$1000";
const X402_MAX_PER_PAYMENT_USD = 1000n;

export type X402Inspection =
  | { status: "payment_required"; httpStatus: 402; required: PaymentRequired }
  | { status: "free"; httpStatus: number; contentType: string; preview: string };

export type X402PaidResult = {
  httpStatus: number;
  contentType: string;
  body: string;
  settlement: unknown | null;
};

function endpoint(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a complete https:// endpoint.");
  }
  if (url.username || url.password) throw new Error("Credentials are not allowed in the URL.");
  const host = url.hostname.toLowerCase();
  const privateHost =
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  const localPage = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(localPage && url.protocol === "http:")) {
    throw new Error("Paid resources must use HTTPS.");
  }
  if (privateHost && !localPage) throw new Error("Local and private-network endpoints are blocked.");
  return url;
}

function requestInit(): RequestInit {
  return {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
    redirect: "follow",
    referrerPolicy: "no-referrer",
    headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.5" },
  };
}

function relayUrl(target: URL) {
  const relay = new URL("/api/x402-proxy", location.origin);
  relay.searchParams.set("url", target.toString());
  return relay;
}

async function textPreview(response: Response, limit = 20_000) {
  const text = await response.text();
  return text.length > limit ? `${text.slice(0, limit)}\n…` : text;
}

/** Inspect only. It never creates a payment payload and never asks the wallet to sign. */
export async function inspectX402(input: string): Promise<X402Inspection> {
  const response = await fetch(relayUrl(endpoint(input)), requestInit());
  if (response.status !== 402) {
    return {
      status: "free",
      httpStatus: response.status,
      contentType: response.headers.get("content-type") || "unknown",
      preview: await textPreview(response),
    };
  }
  const encoded = response.headers.get("payment-required") || response.headers.get("x-payment-required");
  if (!encoded) {
    throw new Error("The endpoint returned HTTP 402 without a PAYMENT-REQUIRED header.");
  }
  return { status: "payment_required", httpStatus: 402, required: decodePaymentRequiredHeader(encoded) };
}

function activeEvmNetwork(wallet: WalletSession) {
  const chainId = Number.parseInt(wallet.chainId, 16);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("The connected wallet returned an invalid chain id.");
  return `eip155:${chainId}` as const;
}

export function offersForCurrentWallet(inspection: X402Inspection, wallet: WalletSession | null) {
  if (inspection.status !== "payment_required") return { payable: [] as PaymentRequirements[], other: [] as PaymentRequirements[] };
  const network = wallet ? activeEvmNetwork(wallet) : "";
  const isPayable = (offer: PaymentRequirements) => {
    if (offer.scheme !== "exact" || offer.network !== network) return false;
    const asset = findDefaultAsset(offer.asset, offer.network);
    if (!asset) return false;
    try {
      return BigInt(offer.amount) <= X402_MAX_PER_PAYMENT_USD * 10n ** BigInt(asset.decimals);
    } catch {
      return false;
    }
  };
  return {
    payable: inspection.required.accepts.filter(isPayable),
    other: inspection.required.accepts.filter((offer) => !isPayable(offer)),
  };
}

/**
 * Pay one fixed-price x402 resource from the currently connected EVM wallet.
 * The client registers only the wallet's active chain, so an offer can never
 * silently move the user to another network. Default assets only; hard $1,000 cap.
 */
export async function payX402(input: string, wallet: WalletSession): Promise<X402PaidResult> {
  if (!window.ethereum) throw new Error("No injected EVM wallet is available.");
  const network = activeEvmNetwork(wallet);
  const address = getAddress(wallet.address);
  const walletClient = createWalletClient({
    account: address,
    transport: custom(window.ethereum),
  });
  const signer = {
    address,
    signTypedData: async (message: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }) =>
      walletClient.signTypedData({
        account: address,
        domain: message.domain,
        types: message.types,
        primaryType: message.primaryType,
        message: message.message,
      } as Parameters<typeof walletClient.signTypedData>[0]),
  };
  const client = x402Client.fromConfig({
    schemes: [{ network, client: new ExactEvmScheme(signer) }],
    spendControls: {
      maxAmountPerPayment: X402_MAX_PER_PAYMENT,
      // Omitted means recognized default assets only (USDC for EVM).
    },
  });
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);
  const response = await fetchWithPayment(relayUrl(endpoint(input)), requestInit());
  const settlementHeader = response.headers.get("payment-response") || response.headers.get("x-payment-response");
  let settlement: unknown | null = null;
  if (settlementHeader) {
    try {
      settlement = decodePaymentResponseHeader(settlementHeader);
    } catch {
      settlement = settlementHeader;
    }
  }
  return {
    httpStatus: response.status,
    contentType: response.headers.get("content-type") || "unknown",
    body: await textPreview(response),
    settlement,
  };
}

export const X402_NETWORK_FAMILIES = [
  { id: "eip155:*", label: "EVM", state: "live" as const, note: "Exact payments from the connected browser wallet on its active chain." },
  { id: "solana:*", label: "Solana", state: "wallet_required" as const },
  { id: "aptos:*", label: "Aptos", state: "wallet_required" as const },
  { id: "algorand:*", label: "Algorand", state: "wallet_required" as const },
  { id: "stellar:*", label: "Stellar", state: "wallet_required" as const },
  { id: "keeta:*", label: "Keeta", state: "wallet_required" as const },
  { id: "hedera:*", label: "Hedera", state: "wallet_required" as const },
  { id: "ccd:*", label: "Concordium", state: "wallet_required" as const },
  { id: "tvm:*", label: "TON", state: "wallet_required" as const },
  { id: "near:*", label: "NEAR", state: "wallet_required" as const },
  { id: "xrpl:*", label: "XRPL", state: "wallet_required" as const },
] as const;
