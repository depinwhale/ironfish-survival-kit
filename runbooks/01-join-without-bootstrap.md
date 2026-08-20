# Runbook 01 — Join the network without the Foundation bootstrap nodes

**Scenario:** `1.main.bn.ironfish.network` / `2.main.bn.ironfish.network` stop resolving
or stop answering. New nodes can't find their first peer. Existing nodes are mostly fine —
they cache every peer they've ever seen in `~/.ironfish/hosts.json` and will reconnect
from that cache.

## Fix for a new node

Point `bootstrapNodes` at any reachable community peer (see [PEERS.md](../PEERS.md)).

Option A — config command:

```bash
ironfish config:set bootstrapNodes '["peer1.example.com:9033","203.0.113.7:9033"]'
ironfish start
```

Option B — edit `~/.ironfish/config.json` directly:

```json
{
  "bootstrapNodes": ["peer1.example.com:9033", "203.0.113.7:9033"]
}
```

Peer discovery is gossip-based: one working bootstrap peer is enough — your node will
learn the rest of the network from it within minutes.

## Fix for an existing node

Usually nothing to do. If your `hosts.json` is stale (node offline for months), apply the
same `bootstrapNodes` override above.

## Verify

```bash
ironfish status   # "P2P Network: CONNECTED ... peers N" with N > 0
ironfish peers    # list of connected peers
```
