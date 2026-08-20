#!/usr/bin/env bash
# Live-check every Foundation-run Iron Fish endpoint. Exit 0 = all up.
set -u
fail=0
ok()   { echo "OK    $1"; }
bad()  { echo "FAIL  $1"; fail=1; }

for h in 1.main.bn.ironfish.network 2.main.bn.ironfish.network; do
  dig +short "$h" A | grep -q . && ok "bootstrap DNS  $h" || bad "bootstrap DNS  $h"
  nc -z -w 5 "$h" 9033 >/dev/null 2>&1 && ok "bootstrap port $h:9033" || bad "bootstrap port $h:9033"
done

curl -sf -m 15 -o /dev/null https://snapshots.ironfish.network/manifest.json && ok "snapshot manifest" || bad "snapshot manifest"
curl -sf -m 15 -o /dev/null https://api.ironfish.network/assets/verified_metadata && ok "assets API" || bad "assets API"
curl -sf -m 15 -o /dev/null https://explorer.ironfish.network && ok "explorer" || bad "explorer"
curl -sf -m 15 -o /dev/null https://ironfish.network && ok "website" || bad "website"

freshness=$(curl -sf -m 15 https://snapshots.ironfish.network/manifest.json 2>/dev/null | python3 -c '
import sys, json, datetime
m = json.load(sys.stdin)
age = (datetime.datetime.now(datetime.timezone.utc)
       - datetime.datetime.fromtimestamp(m["timestamp"]/1000, datetime.timezone.utc)).days
print("%dd old, block %d" % (age, m["block_sequence"]))
sys.exit(0 if age <= 14 else 3)')
case $? in
  0) ok "snapshot freshness ($freshness)" ;;
  3) echo "WARN  snapshot stale: $freshness (service may be winding down)" ;;
  *) bad "snapshot freshness (could not read manifest)" ;;
esac

exit $fail
