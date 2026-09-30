# Futarchy Solana MVP — architecture

## Current devnet MVP

The app is intentionally a thin application layer over Predict's deployed pm-AMM:

1. Phantom signs transactions on Solana devnet.
2. An SPL governance-token balance gates proposal creation.
3. A proposal is represented by a binary pm-AMM market with a `FUT:` name prefix.
4. mUSDC is the collateral.
5. Users buy YES (PASS) or NO (FAIL).
6. The UI derives the live market probability from on-chain reserves and `L_0`.
7. After market end, the MVP labels the market signal PASS/FAIL using a configured threshold.

This is a working market-governance prototype, not yet a production futarchy executor.

## Production target

A production futarchy system should separate:

- proposal account
- conditional PASS market
- conditional FAIL market
- verifiable TWAP accumulator
- decision rule
- timelocked executable Solana instruction payload
- dispute/resolution path
- multisig-controlled upgrades

The executor should only become callable after the decision rule is satisfied and the timelock/dispute period has elapsed.

## Security boundary

Devnet only. The deployed Predict pm-AMM has an authority-based resolution path; this MVP does not claim oracleless or trustless final resolution.
