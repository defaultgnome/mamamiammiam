import type { RecipeNode, WaitNode } from '../model/types'
import { isWait, nodeMap } from '../model/types'

/** Which end of a ranged wait (§2.2) to count. An exact wait has both ends the same. */
export type End = 'min' | 'max'

export type Span = { min: number; max: number }

function waitMinutes(node: RecipeNode, end: End): number {
  if (!isWait(node)) return 0
  const value = end === 'max' ? (node.maxMinutes ?? node.minutes) : node.minutes
  return Math.max(0, value)
}

/**
 * §3.3 — longest-path DP over the graph: sum along a chain, `max` at a merge.
 * Two streams each resting 1h in parallel cost 1h, not 2h.
 */
export function criticalPath(nodes: RecipeNode[], end: End = 'min'): number {
  const byId = nodeMap(nodes)
  const memo = new Map<string, number>()
  const visiting = new Set<string>()

  const upstream = (id: string): number => {
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    const node = byId.get(id)
    if (!node || visiting.has(id)) return 0
    visiting.add(id)
    let best = 0
    for (const input of node.inputs) {
      if (!byId.has(input)) continue
      best = Math.max(best, upstream(input))
    }
    visiting.delete(id)
    const total = best + waitMinutes(node, end)
    memo.set(id, total)
    return total
  }

  let max = 0
  for (const n of nodes) max = Math.max(max, upstream(n.id))
  return max
}

/**
 * The wait as a range: the critical path solved once on the short ends and once on the
 * long ones. The two runs may well follow different paths — each is right on its own.
 */
export function waitSpan(nodes: RecipeNode[]): Span {
  return { min: criticalPath(nodes, 'min'), max: criticalPath(nodes, 'max') }
}

/**
 * Longest downstream wait total per node — the ranking key for the default row
 * order (§3.2). Ranking by a stream's own waits alone would miss a stream that
 * waits little itself but feeds a long rest later, so this looks forward. A ranged
 * wait counts at its long end: the stream that *might* wait longest starts first.
 */
export function downstreamWaits(nodes: RecipeNode[]): Map<string, number> {
  const byId = nodeMap(nodes)
  const consumersOf = new Map<string, string[]>()
  for (const n of nodes) consumersOf.set(n.id, [])
  for (const n of nodes) {
    for (const input of n.inputs) consumersOf.get(input)?.push(n.id)
  }

  const memo = new Map<string, number>()
  const visiting = new Set<string>()

  const walk = (id: string): number => {
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    const node = byId.get(id)
    if (!node || visiting.has(id)) return 0
    visiting.add(id)
    let best = 0
    for (const c of consumersOf.get(id) ?? []) best = Math.max(best, walk(c))
    visiting.delete(id)
    const total = best + waitMinutes(node, 'max')
    memo.set(id, total)
    return total
  }

  for (const n of nodes) walk(n.id)
  return memo
}

/** `prep 20 min + wait 1 h = 1 h 20` — the author's estimate and the derived half. */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${rest} min`
  if (rest === 0) return `${h} h`
  return `${h} h ${String(rest).padStart(2, '0')}`
}

/** `20–30 min`, `1 h–1 h 30`, or a single duration when both ends agree. */
export function formatSpan(span: Span): string {
  if (Math.round(span.min) === Math.round(span.max)) return formatDuration(span.min)
  if (span.max < 60) return `${Math.max(0, Math.round(span.min))}–${Math.round(span.max)} min`
  return `${formatDuration(span.min)}–${formatDuration(span.max)}`
}

export function nodeSpan(node: WaitNode): Span {
  return { min: node.minutes, max: node.maxMinutes ?? node.minutes }
}

/** What a wait's minutes box shows: `20`, or `20-30`. */
export function formatWaitRange(node: Pick<WaitNode, 'minutes' | 'maxMinutes'>): string {
  return node.maxMinutes === undefined
    ? String(node.minutes)
    : `${node.minutes}-${node.maxMinutes}`
}

/**
 * `20` or `20-30` (an en dash or spaces are fine too). A range whose ends are equal is
 * just that number; one that runs backwards is not a range, so it does not parse.
 */
export function parseWaitRange(text: string): Pick<WaitNode, 'minutes' | 'maxMinutes'> | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(?:[-–—]\s*(\d+(?:[.,]\d+)?))?\s*$/.exec(text)
  if (!m) return null
  const minutes = Number(m[1].replace(',', '.'))
  if (m[2] === undefined) return { minutes, maxMinutes: undefined }
  const max = Number(m[2].replace(',', '.'))
  if (max < minutes) return null
  return { minutes, maxMinutes: max > minutes ? max : undefined }
}
