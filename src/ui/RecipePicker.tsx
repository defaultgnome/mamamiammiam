import { useMemo, useState } from 'react'
import fuzzysort from 'fuzzysort'
import type { Recipe } from '../model/types'

type Props = {
  /** what the box shows while nobody is typing in it */
  label: string
  recipes: Recipe[]
  onPick: (recipe: Recipe) => void
  /** second line of a result, to tell two similar titles apart */
  describe: (recipe: Recipe) => string
  placeholder: string
  empty: string
  className?: string
}

/**
 * §2.2 — pick a recipe by typing part of its title. A combobox rather than a select:
 * a library of a hundred recipes is unscrollable in a 228px node, and the cook knows
 * the name, not where it sorts.
 */
export function RecipePicker({
  label,
  recipes,
  onPick,
  describe,
  placeholder,
  empty,
  className,
}: Props) {
  /** null while closed: the box shows `label` instead of a query. */
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const open = query !== null

  const results = useMemo(() => {
    const q = (query ?? '').trim()
    if (!q) return recipes
    return fuzzysort.go(q, recipes, { key: 'title', limit: 50 }).map((r) => r.obj)
  }, [query, recipes])

  const pick = (recipe: Recipe | undefined) => {
    if (recipe) onPick(recipe)
    setQuery(null)
  }

  return (
    <div className="picker">
      <input
        className={className}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={open ? query : label}
        onFocus={() => {
          setQuery('')
          setActive(0)
        }}
        onBlur={() => setQuery(null)}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(results.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            pick(results[active])
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            e.currentTarget.blur()
          }
        }}
      />
      {open && (
        <ul className="picker-list nowheel" role="listbox">
          {results.length === 0 && <li className="picker-empty">{empty}</li>}
          {results.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the input's blur would close the list first.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(r)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="picker-title">{r.title}</span>
              <span className="picker-sub">{describe(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
