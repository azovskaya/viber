# Codex task — Futarchy Solana MVP

Repository: azovskaya/viber

Goal: evolve the existing devnet market-governance MVP into a MetaDAO-style conditional-market futarchy system.

Constraints:
- Keep Solana devnet as the default environment.
- Keep Predict's @pm-amm/sdk for prediction-market mechanics unless a concrete incompatibility is demonstrated.
- Do not move to mainnet.
- Do not put secret keys in source control.
- Preserve Phantom support and the existing mUSDC faucet flow.
- Add tests for every decision invariant.

Next milestones:
1. Add a Proposal model that can encode executable Solana instructions.
2. Replace single final-price thresholding with verifiable TWAP.
3. Model PASS and FAIL conditional worlds.
4. Add a timelocked executor with explicit authority controls.
5. Add market-resolution/dispute handling.
6. Add end-to-end devnet tests.
7. Document threat model and trust assumptions.

Before changing code, inspect the current repository and Predict pm-AMM hackathon/API documentation.
