#!/usr/bin/env node
// Mining-concentration watch for Iron Fish.
// Tallies block producers (graffiti) over the last N blocks from a local node,
// estimates network hashrate, and flags 51%-attack risk.
// Usage: node mining-watch.mjs [--blocks 720] [--datadir ~/.ironfish] [--sdk <path>] [--json]

import { createRequire } from 'module'
import { execSync } from 'child_process'
const require = createRequire(import.meta.url)

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : dflt
}
const N = parseInt(arg('--blocks', '720'), 10)
const dataDir = arg('--datadir', undefined)
const asJson = process.argv.includes('--json')

function loadSdk() {
  const candidates = [arg('--sdk', null), '@ironfish/sdk'].filter(Boolean)
  try {
    candidates.push(execSync('npm root -g', { encoding: 'utf8' }).trim() + '/ironfish/node_modules/@ironfish/sdk')
  } catch {}
  for (const c of candidates) {
    try { return require(c) } catch {}
  }
  console.error('Could not resolve @ironfish/sdk. Pass --sdk <path-to-sdk-package>.')
  process.exit(2)
}

const { IronfishSdk } = loadSdk()
const sdk = await IronfishSdk.init(dataDir ? { dataDir } : {})
const client = await sdk.connectRpc()

const CHUNK = 20
let blocks = []
for (let start = -N; start <= 0; start += CHUNK) {
  const end = Math.min(start + CHUNK - 1, 0)
  const res = await client.chain.getBlocks({ start, end })
  blocks.push(...res.content.blocks.map((b) => b.block))
}
// negative-range chunks can overlap at the head; dedupe by sequence
const bySeq = new Map(blocks.map((b) => [b.sequence, b]))
blocks = [...bySeq.values()].sort((a, b) => a.sequence - b.sequence)

const toHuman = (hex) => {
  const s = Buffer.from(hex, 'hex').toString('utf8').replace(/\0+$/g, '').trim()
  return /^[\x20-\x7e]*$/.test(s) && s.length ? s : (s ? '0x' + hex.slice(0, 16) : '(empty)')
}

const tally = new Map()
for (const b of blocks) {
  const g = toHuman(b.graffiti)
  tally.set(g, (tally.get(g) || 0) + 1)
}
const total = blocks.length
const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1])
const pct = (n) => ((100 * n) / total)

const spanSec = (blocks[total - 1].timestamp - blocks[0].timestamp) / 1000
const avgBlockSec = spanSec / (total - 1)
const avgDifficulty = blocks.reduce((s, b) => s + Number(b.difficulty), 0) / total
const hashrate = avgDifficulty / avgBlockSec // H/s estimate

const top1 = pct(sorted[0][1])
const top3 = pct(sorted.slice(0, 3).reduce((s, [, n]) => s + n, 0))
const alert = top1 > 40 ? (top1 > 51 ? 'CRITICAL' : 'WARNING') : 'OK'

const fmtHash = (h) => {
  const u = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s']
  let i = 0
  while (h >= 1000 && i < u.length - 1) { h /= 1000; i++ }
  return h.toFixed(2) + ' ' + u[i]
}

if (asJson) {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    window: { blocks: total, from: blocks[0].sequence, to: blocks[total - 1].sequence, hours: +(spanSec / 3600).toFixed(1) },
    avgBlockTimeSec: +avgBlockSec.toFixed(1),
    estimatedHashrate: fmtHash(hashrate),
    top1SharePct: +top1.toFixed(1),
    top3SharePct: +top3.toFixed(1),
    alert,
    producers: sorted.map(([g, n]) => ({ graffiti: g, blocks: n, sharePct: +pct(n).toFixed(2) })),
  }, null, 2))
} else {
  console.log(`# Iron Fish mining concentration — ${new Date().toISOString().slice(0, 10)}`)
  console.log(`Window: blocks ${blocks[0].sequence}–${blocks[total - 1].sequence} (${total} blocks, ${(spanSec / 3600).toFixed(1)}h)`)
  console.log(`Avg block time: ${avgBlockSec.toFixed(1)}s · Est. hashrate: ${fmtHash(hashrate)}`)
  console.log(`Top-1 share: ${top1.toFixed(1)}% · Top-3 share: ${top3.toFixed(1)}% · Status: ${alert}`)
  console.log()
  console.log('| Producer (graffiti) | Blocks | Share |')
  console.log('|---|---|---|')
  for (const [g, n] of sorted.slice(0, 15)) {
    console.log(`| \`${g.replace(/\|/g, '\\|')}\` | ${n} | ${pct(n).toFixed(1)}% |`)
  }
  if (sorted.length > 15) console.log(`| _(${sorted.length - 15} more)_ | | |`)
}
client.close()
process.exit(0)
