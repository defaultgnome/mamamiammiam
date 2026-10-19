/** Data model — §2 of SPEC.md. The graph is the source of truth. */

export const RECIPE_VERSION = 2
export const BUNDLE_VERSION = 1

export type Lang = 'en' | 'fr'

export type NodeType = 'ingredient' | 'subrecipe' | 'action' | 'split' | 'wait'

export type BaseNode = {
  id: string
  type: NodeType
  /** node ids feeding this node */
  inputs: string[]
}

/** One ingredient that can fill a slot: `250 g butter`, or its stand-in `250 g margarine`. */
export type IngredientOption = {
  name: string
  /** empty qty/unit ⇒ the ingredient does not scale (§2.2) */
  qty?: number
  unit?: string
  /**
   * §2.2 — an optional second measure of the *same* amount, rendered `1 packet / 10 g`.
   * It is not a conversion factor the app applies: both measures scale by the same
   * multiplier, so the pair stays true at any serving count.
   */
  altQty?: number
  altUnit?: string
}

export type IngredientNode = BaseNode & {
  type: 'ingredient'
  /**
   * §2.2 — the ingredient and its alternatives, any of which will do. Never empty; the
   * first is the one the recipe is written around.
   */
  options: IngredientOption[]
}

/**
 * §2.2 — another recipe used as an ingredient: `2 tart bases · Base à tarte`. Its name
 * and unit are the child's own title and yield, read live, never copied here.
 */
export type SubrecipeNode = BaseNode & {
  type: 'subrecipe'
  /** id of the recipe used; empty until one is picked */
  ref: string
  /** how many of the child's yield (`servingsUnit`) this recipe needs, at baseline */
  qty: number
}

export type ActionNode = BaseNode & {
  type: 'action'
  label: string
}

export type SplitPortion = {
  percent: number
  /** auto-assigned marker: A, B, C … for every portion after the first */
  label: string
}

export type SplitNode = BaseNode & {
  type: 'split'
  portions: SplitPortion[]
}

export type WaitNode = BaseNode & {
  type: 'wait'
  /** the exact wait, or the short end of a range */
  minutes: number
  /** set ⇒ the wait is a range, `minutes`–`maxMinutes`; always greater than `minutes` */
  maxMinutes?: number
  label: string
}

export type RecipeNode = IngredientNode | SubrecipeNode | ActionNode | SplitNode | WaitNode

export type Recipe = {
  version: number
  /** human-readable slug, stable forever */
  id: string
  title: string
  lang: Lang
  servings: number
  /**
   * What `servings` counts — `people`, `quiche`, `tart base`. Free text; empty means
   * people. It is also the recipe's yield: a subrecipe is asked for in this unit.
   */
  servingsUnit?: string
  prepMinutes: number
  note?: string
  tags: string[]
  nodes: RecipeNode[]
  /** presentation override, §3.2 */
  rowOrder: string[]
}

export type Bundle = {
  version: number
  recipes: Recipe[]
}

export const isIngredient = (n: RecipeNode): n is IngredientNode => n.type === 'ingredient'
/** A source opens a row of its own and takes no inputs: an ingredient or a subrecipe. */
export const isSource = (n: RecipeNode): n is IngredientNode | SubrecipeNode =>
  n.type === 'ingredient' || n.type === 'subrecipe'
export const isSplit = (n: RecipeNode): n is SplitNode => n.type === 'split'
export const isWait = (n: RecipeNode): n is WaitNode => n.type === 'wait'

/** Stable index for O(1) lookups during solving. */
export function nodeMap(nodes: RecipeNode[]): Map<string, RecipeNode> {
  return new Map(nodes.map((n) => [n.id, n]))
}

/** Reverse adjacency: node id → ids of nodes consuming it. */
export function consumers(nodes: RecipeNode[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const n of nodes) out.set(n.id, [])
  for (const n of nodes) {
    for (const i of n.inputs) {
      const list = out.get(i)
      if (list) list.push(n.id)
    }
  }
  return out
}
