# Security watch — dependency advisories

The Iron Fish client (`iron-fish/ironfish`) has had no commits since **2025-08-12**. Its
dependency tree is therefore frozen, and vulnerabilities disclosed upstream since then go
unpatched. This page tracks what's in that tree, triaged for **real-world exploitability
in a node/CLI context** — not raw advisory counts.

**Scan date:** 2026-08-21 · **Client:** v2.12.0 (commit b442f9b5)
**Method:** `yarn audit --groups dependencies` (production deps only) + `cargo audit`
against a pinned checkout. Reproduce with [`scripts/security-scan.sh`](scripts/security-scan.sh).

> Raw `yarn audit` reports ~842 findings, but most are in **dev/build tooling** (codecov,
> eslint, test frameworks) that never runs on a node. Filtering to production dependencies
> leaves **55 unique critical/high advisories**, and most of those are not reachable by a
> remote attacker. The triage below is what matters.

## Triage — production dependencies

Rated by whether a **remote peer or RPC caller** can reach the vulnerable code path on a
default node. "Exposure" is the realistic attack surface, not the CVSS score.

| Package | Ver | Used for | Worst advisory | Exposure | Priority |
|---|---|---|---|---|---|
| `ws` | 8.18.0 | **P2P networking** (`webSocketServer/Client.ts`) | GHSA-96hv-2xvq-fx4p — memory-exhaustion DoS from tiny fragments | **Remote, unauthenticated** — every peer speaks ws | **HIGH** |
| `node-forge` | 1.3.1 | **TLS** for RPC (`utils/tls.ts`) | Ed25519/RSA signature forgery (GHSA-q67f-28xg-22rw, -ppp5-5v6c-4jwp); ASN.1 unbounded recursion | Reachable if RPC-over-TLS is exposed; **not** used for consensus signatures | **MEDIUM** |
| `tar` | 6.1.11 | snapshot extraction (`snapshot.ts`) | Path-traversal / arbitrary file write (multiple) | Local — only triggers on a **malicious snapshot**; mitigated by using trusted manifest URLs | **MEDIUM** (mirror operators: HIGH) |
| `axios` | 1.7.7 | outbound HTTP (telemetry, assets API, faucet) | SSRF, proxy-auth leak, several DoS/prototype-pollution | Outbound only; attacker would need to control a URL the node fetches | **LOW–MEDIUM** |
| `tar-fs`, `brace-expansion`, `minimatch`, `picomatch`, `semver`, `braces`, `ip`, `lodash`, `rollup`, `tmp`, `form-data` | various | transitive utility / build helpers | ReDoS, DoS, path-traversal | Mostly not on a remote path; ReDoS needs attacker-controlled input to reach the regex | **LOW** |

### Rust (`cargo audit`)

| Crate | Ver | Via | Advisory | Notes |
|---|---|---|---|---|
| `curve25519-dalek` | 4.0.0 | `ed25519-dalek` (multisig) | RUSTSEC-2024-0344 — timing variability in `Scalar::sub` | Side-channel; matters for **multisig signing on shared hardware**. Fixed in 4.1.3 |
| `openssl` | 0.10.64 | transitive | use-after-free (RUSTSEC-2025-0004, -2025-0022) | Reachable only if the openssl path is exercised; most builds use rustls |
| `bytes`, `h2`, `crossbeam-epoch`, `idna` | — | transitive | overflow / DoS / UB | Low exposure on a node |

## What this means

- **Nothing here is a known remote code execution on a default node.** The realistic
  worst case is a **DoS**: a malicious peer exhausting memory via `ws` (GHSA-96hv-2xvq-fx4p).
  A node crash is recoverable (systemd restart), but a coordinated version could disrupt
  sync for nodes that don't auto-restart.
- **Snapshot trust matters more now.** With `tar` unpatched, only download snapshots from
  a manifest URL you trust, and mirror operators should verify checksums (the mirror
  script does). See [Runbook 02](runbooks/02-sync-from-genesis.md).
- **The signature-forgery advisories in `node-forge` do NOT affect consensus.** Iron Fish
  transaction/spend signatures use the Rust `ironfish-zkp`/`ed25519-dalek` path, not
  node-forge. node-forge is only in the RPC TLS layer.

## Recommended actions (no upstream release needed)

1. **Run nodes under a supervisor that auto-restarts** (systemd `Restart=always`, as in
   [Runbook 03](runbooks/03-community-bootstrap-node-vps.md)) — neutralizes the DoS class.
2. **Don't expose the RPC TLS port publicly.** Keep RPC on localhost/IPC; if remote RPC is
   needed, tunnel over SSH rather than exposing node-forge TLS.
3. **Only sync from trusted snapshot sources.**
4. If anyone regains publish rights, the high-value single bump is **`ws` → latest 8.x**
   (patches the P2P DoS) — a drop-in minor upgrade.

## For a future maintainer

A community fork that only bumped `ws`, `tar`, and `curve25519-dalek`/`ed25519-dalek`
would close the entire remote-reachable set without touching consensus code. This is the
smallest security-meaningful patch and a good first PR if the repo reopens.

_This is a best-effort community assessment, not a formal audit. Re-run the scan monthly;
the advisory landscape moves._
