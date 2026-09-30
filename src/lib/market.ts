import type { MarketAccount } from "@pm-amm/sdk";
import { i80f48ToNumber, priceFromReserves } from "@pm-amm/sdk/math";

export function decodeMarketName(bytes: number[]): string {
  const end = bytes.indexOf(0);
  const useful = end >= 0 ? bytes.slice(0, end) : bytes;
  return new TextDecoder().decode(Uint8Array.from(useful));
}

export function marketProbability(market: MarketAccount, nowSecs = Math.floor(Date.now() / 1000)) {
  const endTs = Number(market.endTs.toString());
  const remaining = Math.max(1, endTs - nowSecs);
  const lEff = i80f48ToNumber(market.lZero) * Math.sqrt(remaining);
  const reserveYes = Number(market.reserveYes.toString());
  const reserveNo = Number(market.reserveNo.toString());
  if (!Number.isFinite(lEff) || lEff <= 0) return 0.5;
  return priceFromReserves(reserveYes, reserveNo, lEff);
}

export function proposalState(probability: number, thresholdBps: number, ended: boolean) {
  if (!ended) return "TRADING" as const;
  return probability * 10_000 >= thresholdBps ? "MARKET_SAYS_PASS" as const : "MARKET_SAYS_FAIL" as const;
}
