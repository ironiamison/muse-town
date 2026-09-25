import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseAbiItem,
  parseEther,
  parseUnits,
  type Address,
} from "viem";

export const ROBINHOOD_CHAIN_ID = 4663;
export const ROBINHOOD_RPC =
  process.env.PONS_RPC_URL?.trim() || "https://rpc.mainnet.chain.robinhood.com";
export const ROBINHOOD_EXPLORER = "https://robinhoodchain.blockscout.com";
export const PONS_FEE_ESCROW =
  "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e" as Address;
export const PONS_V2_FACTORY =
  "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e" as Address;

const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [ROBINHOOD_RPC] } },
  blockExplorers: {
    default: { name: "Robinhood Chain Blockscout", url: ROBINHOOD_EXPLORER },
  },
});

const escrowAbi = parseAbi([
  "function balanceOf(address recipient) view returns (uint256)",
  "function balanceOfToken(address recipient, address token) view returns (uint256)",
]);

const factoryAbi = parseAbi([
  "function feeEscrow() view returns (address)",
  "function getLaunchedToken(address token) view returns ((address token,address curve,address deployer,address creatorFeeRecipient,address pairToken,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,uint16 creatorTaxBps,bool buybackEnabled,uint8 phase,uint256 sweptQuote,uint256 sweptTokens,uint256 sweptAt,bool exists))",
]);

const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
]);
const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

function configuredAddress(value: string | undefined) {
  const candidate = value?.trim() || "";
  return isAddress(candidate) ? getAddress(candidate) : null;
}

export type PonsFundingState = {
  source: "pons_creator_fees";
  status: "awaiting_coin_launch" | "configured" | "rpc_unavailable";
  chain_id: 4663;
  network: "Robinhood Chain";
  token_address: Address | null;
  creator_wallet: Address | null;
  creator_wallet_source: "pons_v2_factory" | null;
  configured_creator_wallet_matches: boolean | null;
  fee_escrow: Address;
  claimable_native_wei: string | null;
  claimable_native_eth: string | null;
  pair_token_address: Address | null;
  pair_token_symbol: string | null;
  pair_token_decimals: number | null;
  claimable_pair_token_atomic: string | null;
  claimable_pair_token_amount: string | null;
  wallet_pair_token_atomic: string | null;
  wallet_pair_token_amount: string | null;
  curve_address: Address | null;
  curve_pair_token_atomic: string | null;
  curve_pair_token_amount: string | null;
  graduation_threshold_atomic: string | null;
  graduation_threshold_amount: string | null;
  graduation_progress_percent: number | null;
  graduation_phase: number | null;
  graduated: boolean;
  wallet_native_wei: string | null;
  wallet_native_eth: string | null;
  token_contract_verified: boolean;
  onchain_checked: boolean;
  checked_at: string | null;
  explorer: string;
  claim_requires_creator_wallet: true;
  unswept_fees_included: false;
  note: string;
};

export async function readPonsFundingState(): Promise<PonsFundingState> {
  const tokenAddress = configuredAddress(process.env.PONS_TOKEN_ADDRESS);
  const configuredCreatorWallet = configuredAddress(process.env.PONS_CREATOR_WALLET);
  const base = {
    source: "pons_creator_fees" as const,
    chain_id: ROBINHOOD_CHAIN_ID as 4663,
    network: "Robinhood Chain" as const,
    token_address: tokenAddress,
    creator_wallet: null,
    creator_wallet_source: null,
    configured_creator_wallet_matches: null,
    fee_escrow: PONS_FEE_ESCROW,
    claimable_native_wei: null,
    claimable_native_eth: null,
    pair_token_address: null,
    pair_token_symbol: null,
    pair_token_decimals: null,
    claimable_pair_token_atomic: null,
    claimable_pair_token_amount: null,
    wallet_pair_token_atomic: null,
    wallet_pair_token_amount: null,
    curve_address: null,
    curve_pair_token_atomic: null,
    curve_pair_token_amount: null,
    graduation_threshold_atomic: null,
    graduation_threshold_amount: null,
    graduation_progress_percent: null,
    graduation_phase: null,
    graduated: false,
    wallet_native_wei: null,
    wallet_native_eth: null,
    token_contract_verified: false,
    onchain_checked: false,
    checked_at: null,
    explorer: ROBINHOOD_EXPLORER,
    claim_requires_creator_wallet: true as const,
    unswept_fees_included: false as const,
  };
  if (!tokenAddress) {
    return {
      ...base,
      status: "awaiting_coin_launch",
      note:
        "Set the real Pons token after launch. No balance is inferred before the launch contract can be verified onchain.",
    };
  }

  try {
    const client = createPublicClient({ chain: robinhoodChain, transport: http(ROBINHOOD_RPC) });
    const [tokenCode, launched, feeEscrow] = await Promise.all([
      client.getCode({ address: tokenAddress }),
      client.readContract({
        address: PONS_V2_FACTORY,
        abi: factoryAbi,
        functionName: "getLaunchedToken",
        args: [tokenAddress],
      }),
      client.readContract({
        address: PONS_V2_FACTORY,
        abi: factoryAbi,
        functionName: "feeEscrow",
      }),
    ]);
    if (!tokenCode || tokenCode === "0x" || !launched.exists) {
      return {
        ...base,
        status: "awaiting_coin_launch",
        token_contract_verified: Boolean(tokenCode && tokenCode !== "0x"),
        onchain_checked: true,
        checked_at: new Date().toISOString(),
        note: "The configured address is not a verified Pons V2 launch, so no creator-fee balance is reported.",
      };
    }
    const creatorWallet = getAddress(launched.creatorFeeRecipient);
    const pairToken = getAddress(launched.pairToken);
    const curveAddress = getAddress(launched.curve);
    const escrowAddress = getAddress(feeEscrow);
    const [claimableNative, claimablePairToken, walletBalance, walletPairToken, pairSymbol, pairDecimals, curvePairToken] = await Promise.all([
      client.readContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "balanceOf",
        args: [creatorWallet],
      }),
      client.readContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "balanceOfToken",
        args: [creatorWallet, pairToken],
      }),
      client.getBalance({ address: creatorWallet }),
      client.readContract({
        address: pairToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [creatorWallet],
      }),
      client.readContract({ address: pairToken, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address: pairToken, abi: erc20Abi, functionName: "decimals" }),
      client.readContract({
        address: pairToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [curveAddress],
      }),
    ]);
    const threshold = launched.graduationThreshold;
    const graduated = Number(launched.phase) >= 2;
    const progress =
      graduated
        ? 100
        : threshold > 0n
        ? Math.min(100, Number((curvePairToken * 1_000_000n) / threshold) / 10_000)
        : null;
    const configuredMatches = configuredCreatorWallet
      ? configuredCreatorWallet.toLowerCase() === creatorWallet.toLowerCase()
      : null;
    return {
      ...base,
      status: "configured",
      creator_wallet: creatorWallet,
      creator_wallet_source: "pons_v2_factory",
      configured_creator_wallet_matches: configuredMatches,
      fee_escrow: escrowAddress,
      claimable_native_wei: claimableNative.toString(),
      claimable_native_eth: formatEther(claimableNative),
      pair_token_address: pairToken,
      pair_token_symbol: pairSymbol,
      pair_token_decimals: pairDecimals,
      claimable_pair_token_atomic: claimablePairToken.toString(),
      claimable_pair_token_amount: formatUnits(claimablePairToken, pairDecimals),
      wallet_pair_token_atomic: walletPairToken.toString(),
      wallet_pair_token_amount: formatUnits(walletPairToken, pairDecimals),
      curve_address: curveAddress,
      curve_pair_token_atomic: curvePairToken.toString(),
      curve_pair_token_amount: formatUnits(curvePairToken, pairDecimals),
      graduation_threshold_atomic: threshold.toString(),
      graduation_threshold_amount: formatUnits(threshold, pairDecimals),
      graduation_progress_percent: progress,
      graduation_phase: Number(launched.phase),
      graduated,
      wallet_native_wei: walletBalance.toString(),
      wallet_native_eth: formatEther(walletBalance),
      token_contract_verified: true,
      onchain_checked: true,
      checked_at: new Date().toISOString(),
      note:
        `Claimable ${pairSymbol} creator fees are read from the Pons V2 fee escrow for the launch's onchain recipient. Curve liquidity is shown separately and is not a spendable reward balance.`,
    };
  } catch {
    return {
      ...base,
      status: "rpc_unavailable",
      note:
        "The configured addresses are present, but Robinhood Chain could not be read. No balance is reported.",
    };
  }
}

export async function verifyPonsTokenPayout(input: {
  txHash: string;
  expectedFrom: string;
  expectedTo: string;
  token: string;
  amount: number;
  decimals: number;
}) {
  if (
    !/^0x[a-f0-9]{64}$/i.test(input.txHash) ||
    !isAddress(input.expectedFrom) ||
    !isAddress(input.expectedTo) ||
    !isAddress(input.token) ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    !Number.isInteger(input.decimals) ||
    input.decimals < 0 ||
    input.decimals > 36
  ) return { ok: false as const, reason: "invalid payout fields" };
  try {
    const client = createPublicClient({ chain: robinhoodChain, transport: http(ROBINHOOD_RPC) });
    const hash = input.txHash as `0x${string}`;
    const [transaction, receipt] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
    ]);
    if (receipt.status !== "success") {
      return { ok: false as const, reason: "transaction did not succeed" };
    }
    if (transaction.from.toLowerCase() !== input.expectedFrom.toLowerCase()) {
      return { ok: false as const, reason: "transaction sender is not the creator wallet" };
    }
    const minimum = parseUnits(String(input.amount), input.decimals);
    const paid = receipt.logs.some((log) => {
      if (log.address.toLowerCase() !== input.token.toLowerCase()) return false;
      try {
        const decoded = decodeEventLog({
          abi: [transferEvent],
          data: log.data,
          topics: log.topics,
        });
        return (
          decoded.eventName === "Transfer" &&
          decoded.args.from.toLowerCase() === input.expectedFrom.toLowerCase() &&
          decoded.args.to.toLowerCase() === input.expectedTo.toLowerCase() &&
          decoded.args.value >= minimum
        );
      } catch {
        return false;
      }
    });
    if (!paid) {
      return { ok: false as const, reason: "confirmed transaction has no matching token transfer" };
    }
    return {
      ok: true as const,
      blockNumber: receipt.blockNumber.toString(),
      valueAtomic: minimum.toString(),
    };
  } catch {
    return { ok: false as const, reason: "transaction is not confirmed on Robinhood Chain" };
  }
}

export async function verifyPonsNativePayout(input: {
  txHash: string;
  expectedFrom: string;
  expectedTo: string;
  amountEth: number;
}) {
  if (
    !/^0x[a-f0-9]{64}$/i.test(input.txHash) ||
    !isAddress(input.expectedFrom) ||
    !isAddress(input.expectedTo) ||
    !Number.isFinite(input.amountEth) ||
    input.amountEth <= 0
  ) return { ok: false as const, reason: "invalid payout fields" };
  try {
    const client = createPublicClient({ chain: robinhoodChain, transport: http(ROBINHOOD_RPC) });
    const hash = input.txHash as `0x${string}`;
    const [transaction, receipt] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
    ]);
    if (receipt.status !== "success") {
      return { ok: false as const, reason: "transaction did not succeed" };
    }
    if (transaction.from.toLowerCase() !== input.expectedFrom.toLowerCase()) {
      return { ok: false as const, reason: "transaction sender is not the creator wallet" };
    }
    if (transaction.to?.toLowerCase() !== input.expectedTo.toLowerCase()) {
      return { ok: false as const, reason: "transaction recipient is not the linked Muse wallet" };
    }
    if (transaction.value < parseEther(String(input.amountEth))) {
      return { ok: false as const, reason: "transaction value is below the signed award" };
    }
    return {
      ok: true as const,
      blockNumber: transaction.blockNumber?.toString() ?? receipt.blockNumber.toString(),
      valueWei: transaction.value.toString(),
    };
  } catch {
    return { ok: false as const, reason: "transaction is not confirmed on Robinhood Chain" };
  }
}
