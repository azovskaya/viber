import { PublicKey } from "@solana/web3.js";

const env = import.meta.env;

export const RPC_URL = env.VITE_SOLANA_RPC || "https://api.devnet.solana.com";
export const PM_AMM_PROGRAM_ID = new PublicKey(
  env.VITE_PM_AMM_PROGRAM_ID || "GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y",
);
export const PM_AMM_COLLATERAL_MINT = new PublicKey(
  env.VITE_PM_AMM_COLLATERAL_MINT || "3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ",
);

export const GOVERNANCE_TOKEN_MINT = env.VITE_GOVERNANCE_TOKEN_MINT
  ? new PublicKey(env.VITE_GOVERNANCE_TOKEN_MINT)
  : null;

export const MIN_PROPOSAL_TOKENS = Number(env.VITE_MIN_PROPOSAL_TOKENS || 1);
export const DECISION_THRESHOLD_BPS = Number(env.VITE_DECISION_THRESHOLD_BPS || 6000);
export const MARKET_DURATION_SECS = Math.max(300, Number(env.VITE_MARKET_DURATION_SECS || 86400));
export const BOOTSTRAP_LIQUIDITY_MUSDC = Number(env.VITE_BOOTSTRAP_LIQUIDITY_MUSDC || 50);
export const FAUCET_URL = "https://pm-amm-devnet.vercel.app/api/faucet";
export const MARKET_PREFIX = "FUT:";
