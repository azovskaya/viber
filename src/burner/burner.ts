/**
 * Burner wallets for pm-AMM devnet apps.
 * Derived from Predict pm-AMM's official hackathon burner-wallet kit.
 * DEVNET ONLY: the secret key lives in localStorage and must never be reused on mainnet.
 */
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { AnchorProvider } from "@anchor-lang/core";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PmAmmClient } from "@pm-amm/sdk";
import bs58 from "bs58";

export const DEVNET = {
  rpc: "https://api.devnet.solana.com",
  programId: new PublicKey("GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y"),
  usdcMint: new PublicKey("3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ"),
  faucetUrl: "https://pm-amm-devnet.vercel.app/api/faucet",
};

const DEFAULT_KEY = "viber-futarchy-burner";

export function loadOrCreateBurner(storageKey = DEFAULT_KEY): Keypair {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      return Keypair.fromSecretKey(bs58.decode(saved));
    } catch {
      // Replace a corrupt devnet-only key.
    }
  }
  const kp = Keypair.generate();
  localStorage.setItem(storageKey, bs58.encode(kp.secretKey));
  return kp;
}

export function resetBurner(storageKey = DEFAULT_KEY): void {
  localStorage.removeItem(storageKey);
}

export interface Balances {
  sol: number;
  usdc: number;
}

export async function getBalances(connection: Connection, owner: PublicKey): Promise<Balances> {
  const ata = getAssociatedTokenAddressSync(DEVNET.usdcMint, owner);
  const [lamports, usdc] = await Promise.all([
    connection.getBalance(owner),
    connection
      .getTokenAccountBalance(ata)
      .then((b) => Number(b.value.uiAmount ?? 0))
      .catch(() => 0),
  ]);
  return { sol: lamports / LAMPORTS_PER_SOL, usdc };
}

export type FundResult =
  | { funded: true; signature: string; usdc: number; sol: number }
  | { funded: false; reason: string; retryAfterSecs?: number };

export async function fundBurner(connection: Connection, owner: PublicKey): Promise<FundResult> {
  try {
    const res = await fetch(DEVNET.faucetUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: owner.toBase58(), role: "player" }),
    });
    const body = await res.json();
    if (!res.ok) {
      const retry = Number(res.headers.get("Retry-After")) || undefined;
      return { funded: false, reason: body.error ?? `faucet ${res.status}`, retryAfterSecs: retry };
    }
    await connection.confirmTransaction(body.signature, "confirmed");
    return { funded: true, signature: body.signature, usdc: body.amount, sol: body.sol ?? 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { funded: false, reason: `faucet unreachable (${msg})` };
  }
}

export const LOW = { sol: 0.003, usdc: 10 };

export async function ensureFunded(connection: Connection, owner: PublicKey) {
  const before = await getBalances(connection, owner);
  if (before.sol >= LOW.sol && before.usdc >= LOW.usdc) return { balances: before, fund: null };
  const fund = await fundBurner(connection, owner);
  return { balances: fund.funded ? await getBalances(connection, owner) : before, fund };
}

export function keypairWallet(kp: Keypair) {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  return {
    publicKey: kp.publicKey,
    payer: kp,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => sign(tx),
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]) => txs.map(sign),
  };
}

export function createBurnerClient(connection: Connection, kp: Keypair): PmAmmClient {
  const provider = new AnchorProvider(connection, keypairWallet(kp), { commitment: "confirmed" });
  return PmAmmClient.fromProvider(provider, DEVNET.programId, DEVNET.usdcMint);
}
