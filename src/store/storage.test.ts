import { describe, expect, it } from 'vitest'
import type { Recipe } from '../model/types'
import { RECIPE_VERSION } from '../model/types'
import { migrateRecipe } from './storage'

const v1 = (nodes: unknown[]): Recipe =>
  ({
    version: 1,
    id: 'old',
    title: 'Old',
    lang: 'en',
    servings: 2,
    prepMinutes: 5,
    tags: [],
    nodes,
    rowOrder: [],
  }) as Recipe

describe('migrateRecipe', () => {
  it('moves a v1 ingredient into a single option', () => {
    const r = migrateRecipe(
      v1([
        {
          id: 'i',
          type: 'ingredient',
          inputs: [],
          name: 'butter',
          qty: 250,
          unit: 'g',
          altQty: 1,
          altUnit: 'cup',
        },
      ]),
    )
    expect(r.version).toBe(RECIPE_VERSION)
    expect(r.nodes[0]).toEqual({
      id: 'i',
      type: 'ingredient',
      inputs: [],
      options: [{ name: 'butter', qty: 250, unit: 'g', altQty: 1, altUnit: 'cup' }],
      ref: undefined,
    })
  })

  it('keeps v2 options as they are', () => {
    const options = [
      { name: 'butter', qty: 250, unit: 'g', altQty: undefined, altUnit: undefined },
      {
        name: 'margarine',
        qty: undefined,
        unit: undefined,
        altQty: undefined,
        altUnit: undefined,
      },
    ]
    const r = migrateRecipe(v1([{ id: 'i', type: 'ingredient', inputs: [], options }]))
    expect(r.nodes[0]).toMatchObject({ options })
  })

  it('drops a wait range that runs backwards or collapses', () => {
    const r = migrateRecipe(
      v1([
        { id: 'a', type: 'wait', inputs: [], minutes: 20, maxMinutes: 30, label: '' },
        { id: 'b', type: 'wait', inputs: [], minutes: 20, maxMinutes: 10, label: '' },
        { id: 'c', type: 'wait', inputs: [], minutes: 20, maxMinutes: 20, label: '' },
      ]),
    )
    expect(r.nodes.map((n) => (n.type === 'wait' ? n.maxMinutes : null))).toEqual([
      30,
      undefined,
      undefined,
    ])
  })
})
