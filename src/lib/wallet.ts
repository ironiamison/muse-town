import { encodeFunctionData, getAddress, parseAbi, parseEther, parseUnits, toHex } from "viem";

const ponsEscrowAbi = parseAbi([
  "function claimToken(address token) returns (uint256 amount)",
]);
const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

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
    "MUSETOOLS PAYMENT WALLET LINK",
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

export async function switchToRobinhoodChain() {
  const wallet = provider();
  try {
    await wallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x1237" }],
    });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? Number((error as { code: unknown }).code)
        : 0;
    if (code !== 4902) throw error;
    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: "0x1237",
        chainName: "Robinhood Chain",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
        blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
      }],
    });
  }
}

export async function claimPonsNativeFees(from: string, feeEscrow: string) {
  await switchToRobinhoodChain();
  return String(
    await provider().request({
      method: "eth_sendTransaction",
      params: [{ from, to: feeEscrow, data: "0x4e71d92d", value: "0x0" }],
    }),
  );
}

export async function claimPonsTokenFees(from: string, feeEscrow: string, token: string) {
  await switchToRobinhoodChain();
  const data = encodeFunctionData({
    abi: ponsEscrowAbi,
    functionName: "claimToken",
    args: [getAddress(token)],
  });
  return String(
    await provider().request({
      method: "eth_sendTransaction",
      params: [{ from, to: feeEscrow, data, value: "0x0" }],
    }),
  );
}

export async function sendNativePayout(from: string, to: string, amountEth: string) {
  await switchToRobinhoodChain();
  const value = parseEther(amountEth.trim());
  if (value <= 0n) throw new Error("Enter a positive ETH amount.");
  return String(
    await provider().request({
      method: "eth_sendTransaction",
      params: [{ from, to, value: toHex(value) }],
    }),
  );
}

export async function sendTokenPayout(
  from: string,
  to: string,
  token: string,
  amount: string,
  decimals: number,
) {
  await switchToRobinhoodChain();
  const value = parseUnits(amount.trim(), decimals);
  if (value <= 0n) throw new Error("Enter a positive token amount.");
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [getAddress(to), value],
  });
  return String(
    await provider().request({
      method: "eth_sendTransaction",
      params: [{ from, to: token, data, value: "0x0" }],
    }),
  );
}

export async function waitForRobinhoodReceipt(hash: string, attempts = 45) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch("https://rpc.mainnet.chain.robinhood.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: attempt + 1,
        method: "eth_getTransactionReceipt",
        params: [hash],
      }),
    });
    const payload = (await response.json()) as {
      result?: { status?: string; blockNumber?: string } | null;
    };
    if (payload.result) {
      if (payload.result.status !== "0x1") throw new Error("The Robinhood Chain transaction failed.");
      return payload.result;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
  }
  throw new Error("The transaction is still pending. Reconcile it on the explorer before retrying.");
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
