# Mining watch — block-producer concentration

A low-hashrate PoW chain in maintenance mode is a prime 51%/double-spend target. This page
tracks how concentrated block production is, so the community has early warning if one
operator approaches majority control.

**Method:** [`scripts/mining-watch.mjs`](scripts/mining-watch.mjs) reads block headers over a
window (default 720 blocks ≈ 12h) from a local node via `chain/exportChainStream`, tallies
producers by their **full 32-byte graffiti** (so distinct miners are never merged), then
groups worker instances into pool operators. No third-party API — runs off your own node.

## Latest snapshot — 2026-08-21 (blocks 1,761,237–1,761,956)

- Avg block time **60.2s** · estimated network hashrate **~337 GH/s**
- **Status: CRITICAL** — top pool over 50%

| Pool (worker instances grouped) | Blocks | Share |
|---|---|---|
| `Mined by herominers.com` | 426 | **59.2%** |
| `pool.kryptex.com` | 244 | 33.9% |
| `Iron Fish Pool` | 50 | 6.9% |

Only **three pools** produced any blocks in this window, and one exceeded a majority.

## What this does and doesn't mean

- **A pool's block share is not the same as it owning that hashrate.** Pools are collections
  of independent miners who can (and, on a healthy network, do) repoint their rigs elsewhere.
  herominers.com at 59% means *the miners currently pointed at herominers* could, if the pool
  operator were malicious or compromised, be directed to attack — not that herominers holds
  59% of the world's FishHash hardware.
- **But a single pool over 50% is the standard concentration red flag**, because it collapses
  the trust assumption to one operator. The mitigation is miner behavior, not code: miners
  spreading across pools (or solo mining) directly lowers this number.
- **This is descriptive monitoring, not an attack claim.** No double-spend or reorg is
  implied or observed here — only that block production is dangerously concentrated.

## The one thing readers can act on

If you mine Iron Fish, **don't point at the largest pool.** Choosing kryptex, Iron Fish Pool,
a smaller pool, or solo mining moves this metric in the safe direction. Decentralization on a
maintenance-mode chain is now purely a function of what miners choose.

## Reproduce / re-run

```bash
# from any synced node (matched CLI + node version)
node scripts/mining-watch.mjs --blocks 720 --sdk /path/to/ironfish/ironfish
node scripts/mining-watch.mjs --blocks 720 --json    # machine-readable
```

_Snapshot regenerated weekly by the maintainer's monitoring task. Numbers move with the
window; treat a single reading as a data point, a sustained >50% as the real signal._
