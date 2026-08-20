# Runbook 02 — Initial sync without the snapshot service

**Scenario:** `snapshots.ironfish.network` is gone. `ironfish chain:download` fails.

## Option A — use a community mirror (fast)

The CLI accepts any manifest URL; mirrors are drop-in:

```bash
ironfish chain:download --manifestUrl https://<mirror-host>/manifest.json
```

Known mirrors: _(add via PR when they exist — see [Runbook 04](04-snapshot-mirror.md))_

## Option B — sync from genesis over P2P (slow but always works)

Skip `chain:download` entirely:

```bash
ironfish start
```

The node downloads every block from peers. Facts to plan around (2026 figures):

- Chain head ≈ block 1.76M; on-disk DB ≈ 25 GB (budget 60+ GB free for headroom).
- Expect 1–3+ days depending on disk (SSD strongly recommended) and peer quality.
- Progress: `ironfish status -f` — watch the `Syncer` and `Blockchain` lines.

## Integrity note

Snapshots are a convenience, not a trust anchor: every block in a snapshot is still
validated against consensus rules. Genesis sync and snapshot sync converge on the same
chain — the manifest `checksum` (sha256) only protects the download against corruption.
