import { useMemo, type ReactNode } from 'react'
import { buildIndex, markKey, searchLibrary, type SearchHit } from '../model/search'
import { useApp } from '../store/app'
import { navigate, useQueryParam, type Route } from '../store/router'
import { formatSpan, waitSpan } from '../solver/time'
import { isModifiedLocally, uniqueId } from '../store/storage'
import { servesText } from '../store/format'
import { LangThemeControls, TopBar } from '../ui/TopBar'
import { newRecipe } from '../model/factory'
import { RATING_ICON, ratedClass } from '../ui/RatingButtons'

/** Renders `text` with the matched runs wrapped in <mark>. */
export function Highlight({ text, marks }: { text: string; marks?: Set<number> }) {
  if (!marks || marks.size === 0) return <>{text}</>
  const out: ReactNode[] = []
  let i = 0
  while (i < text.length) {
    const on = marks.has(i)
    let j = i + 1
    while (j < text.length && marks.has(j) === on) j++
    const chunk = text.slice(i, j)
    // Unmatched runs go in as bare strings: a <span> here would inherit whatever the
    // surrounding pill styles at that depth, which is not this component's business.
    out.push(on ? <mark key={i}>{chunk}</mark> : chunk)
    i = j
  }
  return <>{out}</>
}

export function ListPage({ route }: { route: Route }) {
  const { library, state, t, dispatch } = useApp()
  const [query, setQuery] = useQueryParam(route, 'q')
  // Favourites include the super likes; super favourites are only those.
  const [rated, setRated] = useQueryParam(route, 'rated')

  const index = useMemo(() => buildIndex(library), [library])
  const results = useMemo(
    () =>
      searchLibrary(index, query).filter(({ recipe }) =>
        rated === 'like'
          ? !!recipe.rating
          : rated === 'superlike'
            ? recipe.rating === rated
            : true,
      ),
    [index, query, rated],
  )

  const createRecipe = () => {
    const taken = new Set(library.map((r) => r.id))
    const recipe = newRecipe(uniqueId('untitled', taken), state.prefs.lang)
    dispatch({ type: 'upsert', recipe })
    navigate(`/edit/${recipe.id}`)
  }

  return (
    <>
      <TopBar>
        <LangThemeControls />
        <button className="btn ghost" onClick={() => navigate('/settings')}>
          {t('list.settings')}
        </button>
        <button className="btn primary" onClick={createRecipe}>
          + {t('list.new')}
        </button>
      </TopBar>

      <div className="search-wrap">
        <input
          type="search"
          value={query}
          placeholder={t('list.search')}
          aria-label={t('list.search')}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="list-filters">
        <p className="hint">{t('list.searchHint')}</p>
        <div className="seg rating" role="group" aria-label={t('rating.filter')}>
          <button className="btn small" aria-pressed={!rated} onClick={() => setRated('')}>
            {t('rating.all')}
          </button>
          {(['like', 'superlike'] as const).map((r) => (
            <button
              key={r}
              className={`btn small rate-${r}`}
              aria-pressed={rated === r}
              onClick={() => setRated(rated === r ? '' : r)}
            >
              {RATING_ICON[r]} {t(`rating.only.${r}`)}
            </button>
          ))}
        </div>
      </div>

      {library.length === 0 ? (
        <p className="empty">{t('list.none')}</p>
      ) : results.length === 0 ? (
        <p className="empty">{t('list.empty')}</p>
      ) : (
        <div className="cards">
          {results.map((hit) => (
            <RecipeCard key={hit.recipe.id} hit={hit} />
          ))}
        </div>
      )}
    </>
  )
}

function RecipeCard({ hit }: { hit: SearchHit }) {
  const { t, state, lang } = useApp()
  const { recipe, marks } = hit
  const wait = waitSpan(recipe.nodes)
  const total = { min: recipe.prepMinutes + wait.min, max: recipe.prepMinutes + wait.max }
  const modified = isModifiedLocally(recipe.id, state.overlay)

  // The ingredient list is not on the card, so a match there is invisible unless the
  // matched ingredients are pulled up. This is the whole "why am I seeing this" answer.
  const matchedIngredients = recipe.nodes
    .flatMap((n) => (n.type === 'ingredient' ? n.options.map((o) => o.name) : []))
    .filter((name) => marks.has(markKey('ingredient', name)))
    .filter((name, i, all) => all.indexOf(name) === i)

  return (
    <button className="card" onClick={() => navigate(`/recipe/${recipe.id}`)}>
      <h3 className={ratedClass(recipe.rating)}>
        {recipe.rating && (
          <span className="rating-icon" aria-label={t(`rating.${recipe.rating}`)}>
            {RATING_ICON[recipe.rating]}{' '}
          </span>
        )}
        <Highlight text={recipe.title} marks={marks.get(markKey('title', recipe.title))} />
      </h3>
      <div className="meta">
        {formatSpan(total)} · {servesText(t, recipe.servings, recipe.servingsUnit, lang)}
      </div>
      {matchedIngredients.length > 0 && (
        <div className="matched">
          {matchedIngredients.map((name) => (
            <span className="hit" key={name}>
              <Highlight text={name} marks={marks.get(markKey('ingredient', name))} />
            </span>
          ))}
        </div>
      )}
      <div className="tags">
        <span className="badge lang">{recipe.lang.toUpperCase()}</span>
        {modified && <span className="badge">{t('list.modified')}</span>}
        {recipe.tags.map((tag) => (
          <span className="tag" key={tag}>
            <Highlight text={tag} marks={marks.get(markKey('tag', tag))} />
          </span>
        ))}
      </div>
    </button>
  )
}
