#!/usr/bin/env bash
# Reproduce the SECURITY-WATCH.md dependency scan against an ironfish checkout.
# Usage: security-scan.sh /path/to/ironfish   (default: ~/Desktop/ironfish)
set -u
REPO=${1:-$HOME/Desktop/ironfish}
cd "$REPO" || { echo "checkout not found: $REPO"; exit 1; }

echo "=== ironfish @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown) ==="
echo
echo "### JS production dependencies (yarn audit --groups dependencies)"
yarn audit --groups dependencies 2>/dev/null | tail -1

echo
echo "### Unique critical/high advisories (production only)"
yarn audit --groups dependencies --json 2>/dev/null | python3 -c '
import sys, json
seen=set(); rows=[]
for line in sys.stdin:
    try: d=json.loads(line)
    except: continue
    if d.get("type")!="auditAdvisory": continue
    a=d["data"]["advisory"]
    if a["id"] in seen: continue
    seen.add(a["id"])
    if a["severity"] in ("critical","high"):
        rows.append((a["severity"], a["module_name"], a["title"][:60]))
for s,m,t in sorted(rows): print("%-9s %-16s %s"%(s.upper(),m,t))
print(len(rows),"unique critical/high in production deps")
'
echo
echo "### Rust (cargo audit)"
if command -v cargo-audit >/dev/null 2>&1 || cargo audit --version >/dev/null 2>&1; then
  cargo audit 2>&1 | grep -E "^(Crate|Title|ID|Solution):" || echo "(cargo audit produced no parsable output; check network/advisory-db)"
else
  echo "cargo-audit not installed: brew install cargo-audit"
fi
