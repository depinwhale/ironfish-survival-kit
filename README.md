# Iron Fish Survival Kit

Community-maintained guide to keeping the [Iron Fish](https://ironfish.network) network
joinable and usable if Foundation-run infrastructure goes away.

**Context:** In April 2026 the Iron Fish Foundation
[moved to maintenance mode](https://ironfish.network/learn/blog/2026-04-20) — grants ended,
the Discord closed, and active development stopped. The Foundation still runs the
supporting infrastructure and says, accurately, that "none of this is critical to the
network." This repo documents exactly what that infrastructure is, what breaks if each
piece disappears, and the tested workaround for each.

## The dependency map

Every external endpoint hardcoded in the client (`iron-fish/ironfish` @ v2.12.0):

| Endpoint | Used for | If it goes dark | Workaround |
|---|---|---|---|
| `1.main.bn.ironfish.network:9033`, `2.main.bn.ironfish.network:9033` | bootstrap peers for new nodes (`ironfish/src/networks/definitions/mainnet.ts`) | new nodes can't discover peers; existing nodes keep running on cached `hosts.json` | [Runbook 01 — join without bootstrap](runbooks/01-join-without-bootstrap.md) |
| `snapshots.ironfish.network/manifest.json` | fast initial sync (`ironfish chain:download`) | initial sync falls back to P2P from genesis (days instead of hours) | [Runbook 02 — sync from genesis / use a mirror](runbooks/02-sync-from-genesis.md) |
| `api.ironfish.network` | telemetry, verified-assets metadata (`/assets/verified_metadata`), Chainport bridge config | wallets show assets as unverified; bridge UX breaks; telemetry silently fails | degraded but non-fatal; disable telemetry with `ironfish config:set enableTelemetry false` |
| `explorer.ironfish.network`, `ironfish.network` (site/docs) | block explorer, documentation | loss of docs/explorer UI | source is public: [`iron-fish/website`](https://github.com/iron-fish/website), [`iron-fish/block-explorer`](https://github.com/iron-fish/block-explorer), [`iron-fish/ironfish-api`](https://github.com/iron-fish/ironfish-api) — anyone can self-host |
| `discord.ironfish.network` | community | already closed (2026) | Foundation directs support to support@ironfish.network |

## Baseline (verified 2026-08-19)

- Both bootstrap DNS names resolve (AWS Elastic Beanstalk, us-east-1 + eu-central-1).
- Snapshot service **actively maintained**: manifest served a snapshot generated the same
  day (block 1,759,248 · 26.1 GB · database_version 28).
- Explorer up (HTTP 200). Mainnet chain DB on disk: ~25 GB.
- Network alive: a fresh node syncs and holds ~50 peers.

Re-run this baseline anytime: [`scripts/check-infra.sh`](scripts/check-infra.sh)

## Runbooks

1. [Join the network without the Foundation bootstrap nodes](runbooks/01-join-without-bootstrap.md)
2. [Initial sync without the snapshot service (or from a mirror)](runbooks/02-sync-from-genesis.md)
3. [Run a community bootstrap node on a VPS](runbooks/03-community-bootstrap-node-vps.md)
4. [Run a snapshot mirror](runbooks/04-snapshot-mirror.md)

## Community peer list

See [PEERS.md](PEERS.md). Add your publicly-reachable node via PR.

## Contributing

PRs welcome — especially: peer list entries, corrections after infra changes, and mirror
URLs. Keep claims verifiable (commands + output, not assertions).
