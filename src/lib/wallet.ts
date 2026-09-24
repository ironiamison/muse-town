export type WalletSession = {
  address: string;
  chainId: string;
  providerName: string;
};

type Eip1193Provider = {
  isMetaMask?: boolean;
  request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

function provider() {
  if (!window.ethereum?.request) {
    throw new Error("No injected EVM wallet was found in this browser.");
  }
  return window.ethereum;
}

function firstAddress(value: unknown) {
  if (!Array.isArray(value)) return "";
  const address = String(value[0] || "");
  return /^0x[a-f0-9]{40}$/i.test(address) ? address : "";
}

async function sessionFrom(providerInstance: Eip1193Provider, requestAccess: boolean) {
  const accounts = await providerInstance.request({
    method: requestAccess ? "eth_requestAccounts" : "eth_accounts",
  });
  const address = firstAddress(accounts);
  if (!address) return null;
  const chainId = String(await providerInstance.request({ method: "eth_chainId" }));
  return {
    address,
    chainId,
    providerName: providerInstance.isMetaMask ? "METAMASK" : "BROWSER WALLET",
  } satisfies WalletSession;
}

export async function readWallet() {
  if (!window.ethereum?.request) return null;
  return sessionFrom(window.ethereum, false);
}

export async function connectWallet() {
  return sessionFrom(provider(), true);
}

export function walletChallenge(input: {
  address: string;
  chainId: string;
  museId: string;
  portId: string;
  nonce: string;
}) {
  return [
    "PORT HUMAN WALLET LINK",
    "version=1",
    `port_id=${input.portId}`,
    `muse_id=${input.museId}`,
    `wallet=${input.address}`,
    `chain_id=${input.chainId}`,
    `origin=${window.location.origin}`,
    `nonce=${input.nonce}`,
  ].join(" | ");
}

export function walletNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signWalletChallenge(address: string, challenge: string) {
  const wallet = provider();
  try {
    return String(
      await wallet.request({
        method: "personal_sign",
        params: [challenge, address],
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("reject") || message.includes("denied")) throw error;
    return String(
      await wallet.request({
        method: "personal_sign",
        params: [address, challenge],
      }),
    );
  }
}

export function onWalletChange(listener: () => void) {
  const wallet = window.ethereum;
  if (!wallet?.on) return () => undefined;
  const handler = () => listener();
  wallet.on("accountsChanged", handler);
  wallet.on("chainChanged", handler);
  return () => {
    wallet.removeListener?.("accountsChanged", handler);
    wallet.removeListener?.("chainChanged", handler);
  };
}

export function shortAddress(address: string) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "NO WALLET";
}

export function chainLabel(chainId: string) {
  const known: Record<string, string> = {
    "0x1": "ETHEREUM",
    "0x89": "POLYGON",
    "0xa4b1": "ARBITRUM",
    "0x2105": "BASE",
    "0x1237": "ROBINHOOD CHAIN",
  };
  return known[chainId.toLowerCase()] || `CHAIN ${Number.parseInt(chainId, 16) || chainId}`;
}
