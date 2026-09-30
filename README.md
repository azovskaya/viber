# Futarchy Solana — devnet MVP

A market-governance prototype for Solana, built on the live `@pm-amm/sdk` devnet deployment.

## What this MVP does

- Connects Phantom on Solana devnet.
- Uses an SPL token as a **proposal-creation gate**.
- Creates `FUT:` decision markets through Predict's pm-AMM SDK.
- Bootstraps each proposal with mUSDC liquidity.
- Lets participants buy PASS or FAIL exposure with mUSDC.
- Reads the live pm-AMM probability directly from on-chain reserves.
- Shows a configurable pass threshold.
- Includes the official Predict devnet faucet flow.

This is **market governance**, not `1 token = 1 vote`.

## Important distinction

Strict MetaDAO-style futarchy uses two *conditional token-price markets* (PASS condition and FAIL condition) and decides by TWAP. Predict's pm-AMM is a binary prediction-market engine; it does not by itself provide MetaDAO's conditional-token settlement or governance instruction executor.

So this repository is deliberately an MVP layer on top of pm-AMM. Before production use, add:

1. verifiable/on-chain TWAP (not final-price sampling),
2. a proposal account that stores executable Solana instructions,
3. a timelocked governance executor,
4. a robust resolver/dispute path,
5. multisig/program upgrade controls and an independent audit.

## Sources used

- SolanaSkills / solana.new: Solana app-building ecosystem and the explicit "conditional markets" direction.
- Predict pm-AMM `HACKATHON.md`: devnet program, mUSDC mint, faucet, SDK-first architecture and gotchas.
- `@pm-amm/sdk` README/API: client creation, market creation, swaps and pricing math.
- MetaDAO/Futardio public decision-market behavior: PASS/FAIL market governance and TWAP as the production target.

## Setup

```bash
cp .env.example .env.local
```

Set your **devnet** SPL governance mint:

```env
VITE_GOVERNANCE_TOKEN_MINT=<YOUR_DEVNET_SPL_TOKEN_MINT>
```

Install and run:

```bash
npm install
npm run dev
```

Open the local Vite URL, connect Phantom, switch Phantom to Solana devnet, use the faucet button, and create a proposal.

## Default devnet constants

- pm-AMM program: `GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y`
- mUSDC: `3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ`
- RPC: `https://api.devnet.solana.com`
- market prefix: `FUT:`
- seed probability: `50%`
- bootstrap liquidity: `50 mUSDC`
- market duration: `24h`
- displayed pass threshold: `60%`

## Security boundary

This repository intentionally targets **devnet only**. Do not point it at mainnet without replacing the MVP decision rule with a verifiable TWAP + executor design and completing a security review.


## Deployment

The repository includes a GitHub Pages workflow. A push to `main` builds the Vite app and publishes the devnet MVP at:

`https://azovskaya.github.io/viber/`

For proposal creation, configure a devnet SPL governance mint. Without it, the public build still loads markets, connects Phantom, and exposes the devnet faucet/trading UI, but proposal creation remains gated.
