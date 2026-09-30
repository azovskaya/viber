import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import {
  BOOTSTRAP_LIQUIDITY_MUSDC,
  DECISION_THRESHOLD_BPS,
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
import { useBurnerWallet } from "./burner/useBurnerWallet";
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
  const burner = useBurnerWallet({ storageKey: "viber-hackathon-burner" });
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
      const now = Date.now() / 1000;
      const active = all
        .map(({ publicKey, account }) => {
          const name = decodeMarketName(account.name);
          return { publicKey, account, name, probability: marketProbability(account) };
        })
        .filter((m) => !m.account.resolved && Number(m.account.endTs.toString()) > now)
        .sort((a, b) => Number(a.account.endTs.toString()) - Number(b.account.endTs.toString()));
      setMarkets(active);

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

  async function createProposal() {
    if (!wallet.publicKey) return setNotice("Для создания proposal подключите Phantom в builder mode.");
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
      setNotice(`Proposal создан. Market: ${result.marketPda}. Tx: ${result.signature}`);
      setTitle("");
      await refresh();
    } catch (e) {
      setNotice(`Создание не удалось: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function trade(market: FutarchyMarket, side: "yes" | "no") {
    const amount = Number(tradeAmount[market.publicKey.toBase58()] || 5);
    if (!Number.isFinite(amount) || amount <= 0) return setNotice("Введите корректную сумму mUSDC.");
    if (!burner.client || burner.status !== "ready") {
      return setNotice("Burner wallet ещё готовится. Дождитесь статуса READY.");
    }

    setBusy(true);
    try {
      const sig = await safeSwap(burner.client, market.publicKey, side, amount);
      setNotice(`Сделка ${side.toUpperCase()} подтверждена. Tx: ${sig}`);
      await Promise.all([burner.refresh(), refresh()]);
    } catch (e) {
      setNotice(`Сделка не прошла: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const futarchyMarkets = markets.filter((m) => m.name.startsWith(MARKET_PREFIX));
  const publicMarkets = markets.filter((m) => !m.name.startsWith(MARKET_PREFIX));

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <span className="eyebrow">SOLANA DEVNET · PREDICTION MARKETS · FUTARCHY</span>
          <h1>Viber Markets</h1>
          <p>
            Откройте страницу и торгуйте сразу: burner wallet создаётся автоматически,
            получает тестовые mUSDC/SOL и подписывает devnet-сделки без Phantom.
          </p>
        </div>
        <div className="heroWallet">
          <span className={`burnerState ${burner.status}`}>BURNER {burner.status.toUpperCase()}</span>
          <b>{shortKey(burner.publicKey)}</b>
          <small>
            {burner.balances
              ? `${burner.balances.usdc.toFixed(1)} mUSDC · ${burner.balances.sol.toFixed(4)} SOL`
              : "Funding…"}
          </small>
        </div>
      </header>

      <section className="statusGrid">
        <div className="stat"><span>Network</span><b>Solana Devnet</b></div>
        <div className="stat"><span>pm-AMM</span><b>{shortKey(PM_AMM_PROGRAM_ID)}</b></div>
        <div className="stat"><span>Collateral</span><b>mUSDC · {shortKey(PM_AMM_COLLATERAL_MINT)}</b></div>
        <div className="stat"><span>Markets live</span><b>{markets.length}</b></div>
      </section>

      {burner.status === "error" && (
        <div className="notice">
          Burner funding error: {burner.error}. Нажмите «New burner» и попробуйте снова.
        </div>
      )}

      <section className="panel juryPanel">
        <div>
          <span className="eyebrow">JURY QUICK START</span>
          <h2>Попробуйте продукт за 20 секунд</h2>
          <p>1. Дождитесь BURNER READY. 2. Выберите рынок. 3. Введите 5 mUSDC. 4. Купите YES или NO. Никаких расширений и тестовых токенов вручную.</p>
        </div>
        <button className="secondary" onClick={burner.reset}>New burner</button>
      </section>

      {notice && <div className="notice">{notice}</div>}

      <MarketSection
        title="Live prediction markets"
        eyebrow="REAL DEVNET USE CASE"
        markets={publicMarkets}
        tradeAmount={tradeAmount}
        setTradeAmount={setTradeAmount}
        trade={trade}
        busy={busy || burner.status !== "ready"}
        futarchy={false}
      />

      <MarketSection
        title="Futarchy proposals"
        eyebrow="DAO MARKET GOVERNANCE"
        markets={futarchyMarkets}
        tradeAmount={tradeAmount}
        setTradeAmount={setTradeAmount}
        trade={trade}
        busy={busy || burner.status !== "ready"}
        futarchy
      />

      <section className="panel actionPanel">
        <div>
          <span className="eyebrow">BUILDER MODE</span>
          <h2>Создать futarchy proposal</h2>
          <p>
            Для организатора: Phantom + governance SPL token. Жюри для торговли Phantom не нужен.
            Требование: ≥ {MIN_PROPOSAL_TOKENS} governance-токенов.
          </p>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Fund developer grants" />
        <button disabled={busy} onClick={createProposal}>Create proposal</button>
        <WalletMultiButton />
      </section>

      <section className="panel caveat">
        <h2>Что демонстрирует use case</h2>
        <p>
          Обычные рынки показывают prediction-market UX end-to-end на живом Solana devnet.
          Рынки с префиксом FUT: — слой рыночного управления: участники ставят капитал на PASS/FAIL,
          а не голосуют «1 токен = 1 голос». Production-версия должна заменить final-price rule
          на verifiable TWAP и добавить timelocked executor.
        </p>
      </section>
    </main>
  );
}

type MarketSectionProps = {
  title: string;
  eyebrow: string;
  markets: FutarchyMarket[];
  tradeAmount: Record<string, string>;
  setTradeAmount: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  trade: (market: FutarchyMarket, side: "yes" | "no") => Promise<void>;
  busy: boolean;
  futarchy: boolean;
};

function MarketSection({
  title,
  eyebrow,
  markets,
  tradeAmount,
  setTradeAmount,
  trade,
  busy,
  futarchy,
}: MarketSectionProps) {
  return (
    <>
      <section className="marketHeader">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </section>

      <section className="markets">
        {markets.length === 0 && (
          <div className="empty">
            {futarchy
              ? "Futarchy proposals появятся здесь после создания builder-кошельком."
              : "Активные devnet рынки сейчас не найдены."}
          </div>
        )}
        {markets.map((market) => {
          const key = market.publicKey.toBase58();
          const end = Number(market.account.endTs.toString());
          const state = futarchy
            ? proposalState(market.probability, DECISION_THRESHOLD_BPS, false)
            : "LIVE";
          const yesLabel = futarchy ? "Купить PASS" : "Купить YES";
          const noLabel = futarchy ? "Купить FAIL" : "Купить NO";
          const cleanName = futarchy ? market.name.slice(MARKET_PREFIX.length) : market.name;

          return (
            <article className="market" key={key}>
              <div className="marketTop">
                <div>
                  <span className="pill">{state.replaceAll("_", " ")}</span>
                  <h3>{cleanName}</h3>
                  <small>{shortKey(market.publicKey)} · до {new Date(end * 1000).toLocaleString()}</small>
                </div>
                <div className="probability">
                  <span>{futarchy ? "PASS price" : "YES price"}</span>
                  <b>{(market.probability * 100).toFixed(1)}%</b>
                </div>
              </div>

              <div className="bar"><div style={{ width: `${Math.max(0, Math.min(100, market.probability * 100))}%` }} /></div>

              <div className="tradeRow">
                <input
                  inputMode="decimal"
                  value={tradeAmount[key] ?? "5"}
                  onChange={(e) => setTradeAmount((prev) => ({ ...prev, [key]: e.target.value }))}
                  aria-label="mUSDC amount"
                />
                <span>mUSDC</span>
                <button disabled={busy} onClick={() => trade(market, "yes")}>{yesLabel}</button>
                <button disabled={busy} className="danger" onClick={() => trade(market, "no")}>{noLabel}</button>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
