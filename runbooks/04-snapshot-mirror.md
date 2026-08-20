# Runbook 04 — Run a snapshot mirror

Two modes, in order of preference:

## Mode A — mirror the Foundation snapshot (while it exists)

Weekly cron copies `manifest.json` + the tarball to your storage/CDN. Any S3-compatible
storage with a public bucket works (Cloudflare R2 is free egress; ~26 GB object).

Use [`scripts/snapshot-mirror.sh`](../scripts/snapshot-mirror.sh):

```bash
# after configuring rclone remote "r2:" and bucket "ironfish-snapshots"
./snapshot-mirror.sh https://snapshots.ironfish.network r2:ironfish-snapshots
```

Cron (Sundays 03:00):

```
0 3 * * 0 /opt/survival-kit/snapshot-mirror.sh https://snapshots.ironfish.network r2:ironfish-snapshots >> /var/log/if-snapmirror.log 2>&1
```

Users consume it with:

```bash
ironfish chain:download --manifestUrl https://<your-cdn>/manifest.json
```

## Mode B — generate snapshots from your own node (when the Foundation's is gone)

A snapshot is a tarball of the chain database plus a manifest. From a **stopped** node
(or a copy of its datadir):

```bash
sudo systemctl stop ironfish
TS=$(date +%s%3N)
tar -czf ironfish_snapshot_${TS}.tar.gz -C /home/ironfish/.ironfish/databases chain
sudo systemctl start ironfish
```

Manifest format (from the Foundation service, database_version as of client v2.12 = 28):

```json
{
  "block_sequence": <chain head sequence when tarred>,
  "checksum": "<sha256 of the tarball>",
  "file_name": "ironfish_snapshot_<ts>.tar.gz",
  "file_size": <bytes>,
  "timestamp": <unix ms>,
  "database_version": 28
}
```

Get `block_sequence` from `ironfish status` before stopping; checksum with
`shasum -a 256`. **Layout matters:** `chain:download` extracts with `strip: 1`, so the
tarball must contain exactly one top-level directory (here `chain/`) whose contents are
the database files — the command above produces that layout. Upload both files to the same directory — `chain:download` resolves the
tarball relative to the manifest URL.

> Verify your snapshot restores before publishing: point a fresh datadir at your
> manifest with `--manifestUrl` and let it reach SYNCED.
