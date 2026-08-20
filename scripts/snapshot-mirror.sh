#!/usr/bin/env bash
# Mirror the Iron Fish snapshot to S3-compatible storage via rclone.
# Usage: snapshot-mirror.sh <source-base-url> <rclone-dest>
# e.g.:  snapshot-mirror.sh https://snapshots.ironfish.network r2:ironfish-snapshots
set -euo pipefail

SRC=${1:?usage: snapshot-mirror.sh <source-base-url> <rclone-dest>}
DEST=${2:?usage: snapshot-mirror.sh <source-base-url> <rclone-dest>}
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT

curl -sf -m 30 "$SRC/manifest.json" -o "$WORK/manifest.json"
FILE=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["file_name"])' "$WORK/manifest.json")
SUM=$(python3  -c 'import json,sys; print(json.load(open(sys.argv[1]))["checksum"])'  "$WORK/manifest.json")

# skip if the mirror already has this exact snapshot
if rclone cat "$DEST/manifest.json" 2>/dev/null | grep -q "$SUM"; then
  echo "mirror already current ($FILE)"; exit 0
fi

echo "downloading $FILE ..."
curl -f --retry 3 -C - -o "$WORK/$FILE" "$SRC/$FILE"

echo "verifying checksum ..."
echo "$SUM  $WORK/$FILE" | shasum -a 256 -c -

echo "uploading to $DEST ..."
rclone copyto "$WORK/$FILE" "$DEST/$FILE" --progress
rclone copyto "$WORK/manifest.json" "$DEST/manifest.json"

echo "pruning old snapshots (keep 2 newest) ..."
rclone lsf "$DEST" --include 'ironfish_snapshot_*.tar.gz' | sort | head -n -2 | \
  while read -r old; do rclone deletefile "$DEST/$old"; echo "  pruned $old"; done

echo "mirror updated: $FILE"
