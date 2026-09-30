import type { MarketAccount } from "@pm-amm/sdk";
import type { PublicKey } from "@solana/web3.js";

export type FutarchyMarket = {
  publicKey: PublicKey;
  account: MarketAccount;
  name: string;
  probability: number;
};
