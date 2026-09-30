import { AnchorProvider } from "@anchor-lang/core";
import { PmAmmClient } from "@pm-amm/sdk";
import { estimateSwapOutput, i80f48ToNumber } from "@pm-amm/sdk/math";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { PM_AMM_COLLATERAL_MINT, PM_AMM_PROGRAM_ID } from "./config";

export function readOnlyClient(connection: Connection) {
  return PmAmmClient.readOnly(connection, PM_AMM_PROGRAM_ID, PM_AMM_COLLATERAL_MINT);
}

export function signingClient(connection: Connection, wallet: WalletContextState) {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error("Подключите кошелёк, который умеет подписывать транзакции.");
  }
  const adapterWallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  };
  const provider = new AnchorProvider(connection, adapterWallet, { commitment: "confirmed" });
  return PmAmmClient.fromProvider(provider, PM_AMM_PROGRAM_ID, PM_AMM_COLLATERAL_MINT);
}

export async function safeSwap(
  client: PmAmmClient,
  marketPda: PublicKey,
  side: "yes" | "no",
  humanMusdc: number,
) {
  const market = await client.fetchMarket(marketPda);
  if (!market) throw new Error("Рынок не найден.");

  const rawIn = Math.floor(humanMusdc * 1_000_000);
  if (rawIn <= 0) throw new Error("Введите сумму больше нуля.");

  const now = Math.floor(Date.now() / 1000);
  const remaining = Math.max(1, Number(market.endTs.toString()) - now);
  const lEff = i80f48ToNumber(market.lZero) * Math.sqrt(remaining);
  const reserveYes = Number(market.reserveYes.toString());
  const reserveNo = Number(market.reserveNo.toString());

  const quotedInput = rawIn * 0.98;
  const quote = estimateSwapOutput(reserveYes, reserveNo, lEff, quotedInput, side);
  const minOut = Math.max(1, Math.floor(quote.output * 0.97));
  const direction = side === "yes" ? "usdcToYes" : "usdcToNo";
  return client.send.swap(marketPda, direction, rawIn, minOut);
}
