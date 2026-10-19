import { describe, expect, it } from 'vitest'
import type { Recipe } from './types'
import { canUseAsSubrecipe, findSubrecipeCycle, usedIn } from './subrecipes'

const recipe = (id: string, uses: string[] = []): Recipe => ({
  version: 2,
  id,
  title: id,
  lang: 'fr',
  servings: 1,
  prepMinutes: 0,
  tags: [],
  nodes: uses.map((ref, i) => ({ id: `r${i}`, type: 'subrecipe', inputs: [], ref, qty: 1 })),
  rowOrder: [],
})

// tarte-chocolat and tarte-fruits both use base; base uses pate.
const library = [
  recipe('pate'),
  recipe('base', ['pate']),
  recipe('tarte-chocolat', ['base']),
  recipe('tarte-fruits', ['base', 'base']),
]

describe('subrecipes', () => {
  it('lists the end products a recipe goes into, each once', () => {
    expect(usedIn(library, 'base').map((r) => r.id)).toEqual(['tarte-chocolat', 'tarte-fruits'])
    expect(usedIn(library, 'tarte-fruits')).toEqual([])
  })

  it('refuses the recipe itself', () => {
    expect(canUseAsSubrecipe(library, 'base', 'base')).toBe(false)
  })

  it('refuses anything that already uses the recipe, however far up', () => {
    expect(canUseAsSubrecipe(library, 'pate', 'base')).toBe(false)
    expect(canUseAsSubrecipe(library, 'pate', 'tarte-chocolat')).toBe(false)
  })

  it('allows an unrelated recipe and one further down', () => {
    expect(canUseAsSubrecipe(library, 'tarte-chocolat', 'pate')).toBe(true)
    expect(canUseAsSubrecipe(library, 'tarte-chocolat', 'tarte-fruits')).toBe(true)
  })

  it('finds a loop an import would close', () => {
    expect(findSubrecipeCycle(library)).toBeNull()
    const looped = [...library.filter((r) => r.id !== 'pate'), recipe('pate', ['tarte-fruits'])]
    expect(findSubrecipeCycle(looped)).not.toBeNull()
  })
})
