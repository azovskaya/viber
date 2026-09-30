import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import {
  BOOTSTRAP_LIQUIDITY_MUSDC,
  DECISION_THRESHOLD_BPS,
  FAUCET_URL,
  GOVERNANCE_TOKEN_MINT,
  MARKET_DURATION_SECS,
  MARKET_PREFIX,
  MIN_PROPOSAL_TOKENS,
  PM_AMM_COLLATERAL_MINT,
  PM_AMM_PROGRAM_ID,
} from "./lib/config";
import { decodeMarketName, marketProbability, proposalState } from "./lib/market";
import { readOnlyClient, safeSwap, signingClient } from "./lib/pmAmm";
import { readTokenBalance } from "./lib/tokenGate";
import type { FutarchyMarket } from "./types";

function shortKey(key: PublicKey | null | undefined) {
  if (!key) return "—";
  const s = key.toBase58();
  return `${s.slice(0, 5)}…${s.slice(-5)}`;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function App() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const ro = useMemo(() => readOnlyClient(connection), [connection]);

  const [markets, setMarkets] = useState<FutarchyMarket[]>([]);
  const [govBalance, setGovBalance] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [tradeAmount, setTradeAmount] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const all = await ro.fetchAllMarkets(443);
      const futarchy = all
        .map(({ publicKey, account }) => {
          const name = decodeMarketName(account.name);
          return { publicKey, account, name, probability: marketProbability(account) };
        })
        .filter((m) => m.name.startsWith(MARKET_PREFIX))
        .sort((a, b) => Number(b.account.startTs.toString()) - Number(a.account.startTs.toString()));
      setMarkets(futarchy);

      if (wallet.publicKey && GOVERNANCE_TOKEN_MINT) {
        setGovBalance(await readTokenBalance(connection, wallet.publicKey, GOVERNANCE_TOKEN_MINT));
      } else {
        setGovBalance(null);
      }
    } catch (e) {
      setNotice(`Не удалось обновить рынки: ${errorText(e)}`);
    }
  }, [connection, ro, wallet.publicKey]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function faucet() {
    if (!wallet.publicKey) return setNotice("Сначала подключите Phantom.");
    setBusy(true);
    try {
      const res = await fetch(FAUCET_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: wallet.publicKey.toBase58() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || body?.message || `Faucet HTTP ${res.status}`);
      setNotice(`Devnet faucet: получено тестовое обеспечение. Tx: ${body.signature ?? "ok"}`);
    } catch (e) {
      setNotice(`Faucet: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function createProposal() {
    if (!wallet.publicKey) return setNotice("Сначала подключите Phantom.");
    if (!GOVERNANCE_TOKEN_MINT) return setNotice("Governance mint ещё не настроен для этого деплоя.");
    if ((govBalance ?? 0) < MIN_PROPOSAL_TOKENS) {
      return setNotice(`Для предложения нужно минимум ${MIN_PROPOSAL_TOKENS} governance-токенов.`);
    }
    const marketName = `${MARKET_PREFIX}${title.trim()}`;
    if (!title.trim()) return setNotice("Введите название предложения.");
    if (new TextEncoder().encode(marketName).length > 64) {
      return setNotice("Название слишком длинное: максимум 64 байта вместе с префиксом FUT:.");
    }

    setBusy(true);
    try {
      const client = signingClient(connection, wallet);
      const result = await client.send.createMarket({
        name: marketName,
        durationSecs: MARKET_DURATION_SECS,
        initialPriceBps: 5000,
        depositUsdc: BOOTSTRAP_LIQUIDITY_MUSDC,
      });
      setNotice(`Предложение создано. Market: ${result.marketPda}. Tx: ${result.signature}`);
      setTitle("");
      await refresh();
    } catch (e) {
      setNotice(`Создание не удалось: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function trade(market: FutarchyMarket, side: "yes" | "no") {
    if (!wallet.publicKey) return setNotice("Сначала подключите Phantom.");
    const amount = Number(tradeAmount[market.publicKey.toBase58()] || 5);
    if (!Number.isFinite(amount) || amount <= 0) return setNotice("Введите корректную сумму mUSDC.");
    setBusy(true);
    try {
      const client = signingClient(connection, wallet);
      const sig = await safeSwap(client, market.publicKey, side, amount);
      setNotice(`Сделка ${side.toUpperCase()} отправлена. Tx: ${sig}`);
      await refresh();
    } catch (e) {
      setNotice(`Сделка не прошла: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <span className="eyebrow">SOLANA DEVNET · MARKET GOVERNANCE</span>
          <h1>Futarchy Solana</h1>
          <p>
            Предложения создают держатели SPL-токена. Решение выражается через рынок pm-AMM,
            где капитал, а не количество кошельков, формирует вероятность PASS.
          </p>
        </div>
        <WalletMultiButton />
      </header>

      <section className="statusGrid">
        <div className="stat"><span>pm-AMM</span><b>{shortKey(PM_AMM_PROGRAM_ID)}</b></div>
        <div className="stat"><span>Collateral</span><b>mUSDC · {shortKey(PM_AMM_COLLATERAL_MINT)}</b></div>
        <div className="stat"><span>PASS threshold</span><b>{(DECISION_THRESHOLD_BPS / 100).toFixed(0)}%</b></div>
        <div className="stat"><span>Your governance balance</span><b>{govBalance == null ? "—" : govBalance.toLocaleString()}</b></div>
      </section>

      <section className="panel actionPanel">
        <div>
          <h2>Создать предложение</h2>
          <p>Требуется ≥ {MIN_PROPOSAL_TOKENS} governance-токенов. Стартовая вероятность 50/50.</p>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Выделить 10 000 USDC на разработку" />
        <button disabled={busy} onClick={createProposal}>Создать рынок предложения</button>
        <button className="secondary" disabled={busy} onClick={faucet}>Получить devnet SOL + mUSDC</button>
      </section>

      {notice && <div className="notice">{notice}</div>}

      <section className="marketHeader">
        <div>
          <span className="eyebrow">LIVE DECISION MARKETS</span>
          <h2>Предложения</h2>
        </div>
        <button className="secondary" onClick={refresh}>Обновить</button>
      </section>

      <section className="markets">
        {markets.length === 0 && <div className="empty">Пока нет рынков с префиксом FUT: на текущем devnet deployment.</div>}
        {markets.map((market) => {
          const key = market.publicKey.toBase58();
          const end = Number(market.account.endTs.toString());
          const ended = Date.now() / 1000 >= end;
          const state = proposalState(market.probability, DECISION_THRESHOLD_BPS, ended);
          return (
            <article className="market" key={key}>
              <div className="marketTop">
                <div>
                  <span className="pill">{state.replaceAll("_", " ")}</span>
                  <h3>{market.name.slice(MARKET_PREFIX.length)}</h3>
                  <small>{shortKey(market.publicKey)} · до {new Date(end * 1000).toLocaleString()}</small>
                </div>
                <div className="probability">
                  <span>PASS market price</span>
                  <b>{(market.probability * 100).toFixed(1)}%</b>
                </div>
              </div>
              <div className="bar"><div style={{ width: `${Math.max(0, Math.min(100, market.probability * 100))}%` }} /></div>
              {!ended && (
                <div className="tradeRow">
                  <input
                    inputMode="decimal"
                    value={tradeAmount[key] ?? "5"}
                    onChange={(e) => setTradeAmount((prev) => ({ ...prev, [key]: e.target.value }))}
                    aria-label="mUSDC amount"
                  />
                  <span>mUSDC</span>
                  <button disabled={busy} onClick={() => trade(market, "yes")}>Купить PASS</button>
                  <button disabled={busy} className="danger" onClick={() => trade(market, "no")}>Купить FAIL</button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="panel caveat">
        <h2>Что здесь является MVP</h2>
        <p>
          Это рабочий devnet-слой рыночного управления поверх pm-AMM. Текущая версия показывает
          цену рынка в момент закрытия. Для production-футархии следующий обязательный шаг —
          on-chain/верифицируемый TWAP PASS/FAIL и контракт исполнения proposal payload. Пока
          автоматического исполнения treasury-инструкций здесь нет.
        </p>
      </section>
    </main>
  );
}
