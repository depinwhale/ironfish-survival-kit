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

// Current chain head, so the window can be an absolute range.
const info = await client.chain.getChainInfo()
const head = Number(info.content.currentBlockIdentifier.index)
const from = Math.max(1, head - N + 1)

// exportChainStream returns header-only blocks (no transactions), streamed —
// far lighter than getBlocks, which ships full transaction arrays and drops
// the IPC socket over a wide range.
let blocks = []
const stream = client.chain.exportChainStream({ start: from, stop: head })
for await (const item of stream.contentStream()) {
  if (item.block && item.block.main) blocks.push(item.block)
}
const bySeq = new Map(blocks.map((b) => [b.sequence, b]))
blocks = [...bySeq.values()].sort((a, b) => a.sequence - b.sequence)

// Identity = the FULL 32-byte graffiti hex (two blocks are the same miner only
// if their entire graffiti matches). The human label is derived for display but
// never used as the key, so distinct miners are never merged by a shared prefix.
const labelFor = (hex) => {
  const printable = Buffer.from(hex, 'hex').toString('utf8').replace(/[^\x20-\x7e]/g, '').trim()
  if (printable.length >= 3) return printable
  return '0x' + hex.replace(/0+$/, '').slice(0, 16) // opaque/binary graffiti: short-hex tag
}

const tally = new Map() // full-hex key -> { label, n }
for (const b of blocks) {
  const key = b.graffiti
  const cur = tally.get(key) || { label: labelFor(b.graffiti), n: 0 }
  cur.n += 1
  tally.set(key, cur)
}
const total = blocks.length
const pct = (n) => ((100 * n) / total)

// Raw producers (unique full-graffiti identities).
const producers = [...tally.values()].sort((a, b) => b.n - a.n)

// Pool grouping: a pool operator controls all its worker instances, so for a
// 51%-risk metric we collapse a label's trailing instance identifier
// (" [2dcd]", " 10742145", "-3") into the operator name.
const poolOf = (label) =>
  label
    .replace(/\s*\[[0-9a-fx]+\]\s*$/i, '')
    .replace(/[\s#-]+\d{3,}\s*$/, '')
    .trim() || label
const pools = new Map()
for (const p of producers) {
  const k = poolOf(p.label)
  pools.set(k, (pools.get(k) || 0) + p.n)
}
const poolList = [...pools.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n)

const spanSec = (blocks[total - 1].timestamp - blocks[0].timestamp) / 1000
const avgBlockSec = spanSec / (total - 1)
const avgDifficulty = blocks.reduce((s, b) => s + Number(b.difficulty), 0) / total
const hashrate = avgDifficulty / avgBlockSec // H/s estimate

// Alert is driven by POOL concentration — the meaningful 51% metric.
const poolTop1 = pct(poolList[0].n)
const poolTop3 = pct(poolList.slice(0, 3).reduce((s, p) => s + p.n, 0))
const alert = poolTop1 > 50 ? 'CRITICAL' : poolTop1 > 40 ? 'WARNING' : 'OK'

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
    poolTop1SharePct: +poolTop1.toFixed(1),
    poolTop3SharePct: +poolTop3.toFixed(1),
    alert,
    pools: poolList.map((p) => ({ pool: p.label, blocks: p.n, sharePct: +pct(p.n).toFixed(2) })),
    producers: producers.map((p) => ({ graffiti: p.label, blocks: p.n, sharePct: +pct(p.n).toFixed(2) })),
  }, null, 2))
} else {
  console.log(`# Iron Fish mining concentration — ${new Date().toISOString().slice(0, 10)}`)
  console.log(`Window: blocks ${blocks[0].sequence}–${blocks[total - 1].sequence} (${total} blocks, ${(spanSec / 3600).toFixed(1)}h)`)
  console.log(`Avg block time: ${avgBlockSec.toFixed(1)}s · Est. hashrate: ${fmtHash(hashrate)}`)
  console.log(`Top pool: ${poolTop1.toFixed(1)}% · Top-3 pools: ${poolTop3.toFixed(1)}% · Status: ${alert}`)
  console.log()
  console.log('## By pool (worker instances grouped)')
  console.log('| Pool | Blocks | Share |')
  console.log('|---|---|---|')
  for (const p of poolList.slice(0, 10)) {
    console.log(`| \`${p.label.replace(/\|/g, '\\|')}\` | ${p.n} | ${pct(p.n).toFixed(1)}% |`)
  }
  console.log()
  console.log('## By raw graffiti (top 15)')
  console.log('| Producer (graffiti) | Blocks | Share |')
  console.log('|---|---|---|')
  for (const p of producers.slice(0, 15)) {
    console.log(`| \`${p.label.replace(/\|/g, '\\|')}\` | ${p.n} | ${pct(p.n).toFixed(1)}% |`)
  }
  if (producers.length > 15) console.log(`| _(${producers.length - 15} more)_ | | |`)
}
client.close()
process.exit(0)
