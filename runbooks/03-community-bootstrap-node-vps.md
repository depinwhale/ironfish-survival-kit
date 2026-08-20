# Runbook 03 — Run a community bootstrap node on a VPS

A bootstrap node is just an ordinary, always-on, publicly-reachable node whose address
people put in `bootstrapNodes`. There is no special software.

## Specs

| | Minimum | Comfortable |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 80 GB SSD | 160 GB NVMe (chain ≈ 25 GB and growing) |
| Network | public IPv4, 9033/tcp open | + a DNS A record |

Ubuntu 24.04 LTS assumed below. Typical cost: $10–20/month.

## Setup

```bash
# 1. Node.js 20 + ironfish CLI
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g ironfish

# 2. Dedicated user
sudo useradd -m -s /bin/bash ironfish

# 3. Firewall
sudo ufw allow OpenSSH
sudo ufw allow 9033/tcp comment 'ironfish p2p'
sudo ufw enable

# 4. Fast initial sync (while the Foundation snapshot service is still up)
sudo -u ironfish ironfish chain:download

# 5. Give the node a name (shows up to peers)
sudo -u ironfish ironfish config:set nodeName "community-bn-1"
```

## systemd unit

`/etc/systemd/system/ironfish.service`:

```ini
[Unit]
Description=Iron Fish node
After=network-online.target
Wants=network-online.target

[Service]
User=ironfish
ExecStart=/usr/bin/ironfish start
Restart=always
RestartSec=10
# node.js heap headroom
Environment=NODE_OPTIONS=--max-old-space-size=4096
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ironfish
journalctl -u ironfish -f   # watch it sync
```

## DNS + publishing

1. Add an A record, e.g. `bn1.yourdomain.tld → <VPS IP>`.
2. Verify from anywhere: `nc -vz -w 5 bn1.yourdomain.tld 9033`
3. Open a PR adding it to [PEERS.md](../PEERS.md).

## Keep it healthy

- Auto-restart is handled by systemd (`Restart=always`).
- Watch disk: the chain grows; alert at 80% (`scripts/check-infra.sh` has a local mode).
- Upgrades: `sudo npm update -g ironfish && sudo systemctl restart ironfish`.
  In maintenance mode releases are rare — subscribe to the repo's releases feed.
