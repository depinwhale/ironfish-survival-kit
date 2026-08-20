# Community peer list

Publicly-reachable Iron Fish mainnet nodes, usable as `bootstrapNodes` entries if the
Foundation bootstrap nodes go away. See
[Runbook 01](runbooks/01-join-without-bootstrap.md) for how to use these.

| Address | Operator | Region | Online since | Notes |
|---|---|---|---|---|
| _(none yet — add yours via PR)_ | | | | |

## Requirements for listing

- Node reachable on a public IP or DNS name, WebSocket port open (default 9033/tcp)
- Synced to mainnet head
- Expected uptime: best effort, but please remove your entry if you shut down

## How to verify a peer is reachable

```bash
nc -vz -w 5 <host> 9033
```
