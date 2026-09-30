import { useCallback, useEffect, useMemo, useState } from "react";
import { Connection, Keypair } from "@solana/web3.js";
import type { PmAmmClient } from "@pm-amm/sdk";
import {
  DEVNET,
  type Balances,
  createBurnerClient,
  ensureFunded,
  getBalances,
  loadOrCreateBurner,
  resetBurner,
} from "./burner";

export type BurnerStatus = "loading" | "funding" | "ready" | "error";

export function useBurnerWallet(opts: { storageKey?: string; rpc?: string } = {}) {
  const { storageKey, rpc = DEVNET.rpc } = opts;
  const connection = useMemo(() => new Connection(rpc, "confirmed"), [rpc]);
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [status, setStatus] = useState<BurnerStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setKeypair(loadOrCreateBurner(storageKey)), [storageKey]);

  const client: PmAmmClient | null = useMemo(
    () => (keypair ? createBurnerClient(connection, keypair) : null),
    [connection, keypair],
  );

  useEffect(() => {
    if (!keypair) return;
    let cancelled = false;
    setStatus("funding");
    ensureFunded(connection, keypair.publicKey).then(({ balances, fund }) => {
      if (cancelled) return;
      setBalances(balances);
      const empty = balances.sol === 0 || balances.usdc === 0;
      if (fund && !fund.funded && empty) {
        setError(fund.reason);
        setStatus("error");
      } else {
        setError(null);
        setStatus("ready");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [connection, keypair]);

  const refresh = useCallback(async () => {
    if (keypair) setBalances(await getBalances(connection, keypair.publicKey));
  }, [connection, keypair]);

  return {
    publicKey: keypair?.publicKey ?? null,
    client,
    balances,
    status,
    error,
    refresh,
    reset: () => {
      resetBurner(storageKey);
      setKeypair(loadOrCreateBurner(storageKey));
    },
  };
}
