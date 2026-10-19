import type { Recipe } from './types'

/** Ids of the recipes `recipe` uses as subrecipes, each once. */
export function subrecipeRefs(recipe: Recipe): string[] {
  const out = new Set<string>()
  for (const n of recipe.nodes) if (n.type === 'subrecipe' && n.ref) out.add(n.ref)
  return [...out]
}

/** Does `fromId` use `targetId`, directly or through a chain of subrecipes? */
export function reaches(library: Recipe[], fromId: string, targetId: string): boolean {
  const byId = new Map(library.map((r) => [r.id, r]))
  const stack = [fromId]
  const seen = new Set<string>()
  while (stack.length) {
    const id = stack.pop()!
    if (id === targetId) return true
    if (seen.has(id)) continue
    seen.add(id)
    const r = byId.get(id)
    if (r) stack.push(...subrecipeRefs(r))
  }
  return false
}

/**
 * §2.2 — can `recipeId` take `candidateId` as a subrecipe? Not itself, and not anything
 * that already uses it: A in B in A has no bottom, so a scaling chain or a "used in"
 * list built on it would never end.
 */
export function canUseAsSubrecipe(library: Recipe[], recipeId: string, candidateId: string) {
  return candidateId !== recipeId && !reaches(library, candidateId, recipeId)
}

/**
 * Two recipes that end up using each other, or null. Run on a whole library — an import
 * can close a loop no single recipe shows on its own.
 */
export function findSubrecipeCycle(library: Recipe[]): [string, string] | null {
  for (const r of library) {
    for (const ref of subrecipeRefs(r)) {
      if (reaches(library, ref, r.id)) return [r.id, ref]
    }
  }
  return null
}

/** §2.2 — the end products: every recipe that uses `id` as a subrecipe. */
export function usedIn(library: Recipe[], id: string): Recipe[] {
  return library.filter((r) => r.id !== id && subrecipeRefs(r).includes(id))
}
