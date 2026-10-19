import { lazy, Suspense, useMemo, useState } from 'react'
import { useApp } from '../store/app'
import { navigate } from '../store/router'
import { formatDuration, formatSpan, waitSpan } from '../solver/time'
import { Diagram, type Orientation } from '../ui/Diagram'
import { LangThemeControls, TopBar } from '../ui/TopBar'
import { useWakeLock } from '../ui/useWakeLock'
import { isModifiedLocally } from '../store/storage'
import { usedIn } from '../model/subrecipes'
import { servesText } from '../store/format'
import { NumberField } from '../ui/NumberField'
import { RatingButtons, ratedClass } from '../ui/RatingButtons'

// The DOM-to-image library is only needed once you actually press Share.
const ShareDialog = lazy(() =>
  import('../ui/ShareDialog').then((m) => ({ default: m.ShareDialog })),
)

const PRESETS = [1, 2, 4, 6, 8]

export function RecipePage({ id, initialServings }: { id: string; initialServings?: number }) {
  const { library, state, dispatch, t, lang } = useApp()
  const recipe = library.find((r) => r.id === id)

  // §4.3 / §4.4 — done marks and the multiplier are in memory only. A refresh clears
  // them; they are about this cooking session, not about the recipe.
  const [done, setDone] = useState<Set<string>>(() => new Set())
  // A parent opening this as its subrecipe says how much of it it needs (§2.2).
  const [servings, setServings] = useState<number | null>(initialServings ?? null)
  // Horizontal everywhere, phones included: time running left-to-right is what makes
  // the picture readable as a recipe, and a narrow screen scrolls sideways far more
  // happily than it gives up that reading. Vertical stays one tap away.
  const [orientation, setOrientation] = useState<Orientation>('horizontal')
  const [sharing, setSharing] = useState(false)
  const wakeLock = useWakeLock()

  // A recipe may not reference itself (§2.2). Excluding its own id makes a self
  // reference render as the visible 'missing recipe' marker rather than a link that
  // goes nowhere.
  const recipesById = useMemo(
    () => new Map(library.filter((r) => r.id !== id).map((r) => [r.id, r])),
    [library, id],
  )
  const parents = useMemo(() => usedIn(library, id), [library, id])

  if (!recipe) {
    return (
      <>
        <TopBar back="/" />
        <p className="empty">{t('recipe.notFound')}</p>
      </>
    )
  }

  const effectiveServings = servings ?? recipe.servings
  const multiplier = recipe.servings > 0 ? effectiveServings / recipe.servings : 1
  const wait = waitSpan(recipe.nodes)
  const total = { min: recipe.prepMinutes + wait.min, max: recipe.prepMinutes + wait.max }
  const modified = isModifiedLocally(recipe.id, state.overlay)

  const toggleDone = (nodeId: string) =>
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })

  return (
    <>
      <TopBar back="/">
        <LangThemeControls />
        <button className="btn" onClick={() => navigate(`/edit/${recipe.id}`)}>
          {t('recipe.edit')}
        </button>
        <button className="btn primary" onClick={() => setSharing(true)}>
          {t('recipe.share')}
        </button>
      </TopBar>

      <div className="recipe-head">
        <h1 className={ratedClass(recipe.rating)}>{recipe.title}</h1>
        <div className="time">
          {t('recipe.prep', { prep: formatDuration(recipe.prepMinutes) })}
          {' + '}
          {t('recipe.wait', { wait: formatSpan(wait) })} = <b>{formatSpan(total)}</b>
        </div>
        <div className="tags">
          <span className="badge lang">{recipe.lang.toUpperCase()}</span>
          {modified && <span className="badge">{t('list.modified')}</span>}
          {recipe.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <RatingButtons
          rating={recipe.rating}
          t={t}
          onChange={(rating) => {
            const next = { ...recipe, rating }
            if (!rating) delete next.rating
            dispatch({ type: 'upsert', recipe: next })
          }}
        />
        {recipe.note && <div className="note">{recipe.note}</div>}
        {/* §2.2 — the end products this recipe goes into, found from their side. */}
        {parents.length > 0 && (
          <div className="used-in">
            <span className="hint">{t('recipe.usedIn')}</span>
            {parents.map((r) => (
              <a key={r.id} className="tag" href={`#/recipe/${encodeURIComponent(r.id)}`}>
                {r.title}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="servings">
        <span className="hint">{t('recipe.servings')}</span>
        <div className="seg" role="group" aria-label={t('recipe.servings')}>
          {PRESETS.map((n) => (
            <button
              key={n}
              className="btn small"
              aria-pressed={effectiveServings === n}
              onClick={() => setServings(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <NumberField
          min={0.25}
          value={effectiveServings}
          aria-label={t('recipe.servings')}
          onChange={setServings}
        />
        <span className="hint">
          {servesText(t, effectiveServings, recipe.servingsUnit, lang)}
        </span>
        {servings !== null && servings !== recipe.servings && (
          <button className="btn ghost small" onClick={() => setServings(null)}>
            {t('recipe.reset')}
          </button>
        )}
        <div className="spacer" />
        <div className="seg" role="group" aria-label={t('recipe.orientation')}>
          {(['horizontal', 'vertical'] as const).map((o) => (
            <button
              key={o}
              className="btn small"
              aria-pressed={orientation === o}
              onClick={() => setOrientation(o)}
            >
              {t(`recipe.${o}`)}
            </button>
          ))}
        </div>
        {wakeLock.supported && (
          <button
            className="btn small"
            aria-pressed={wakeLock.enabled}
            onClick={() => wakeLock.setEnabled(!wakeLock.enabled)}
          >
            ☀ {t('recipe.wakeLock')}
          </button>
        )}
      </div>

      <Diagram
        recipe={recipe}
        multiplier={multiplier}
        lang={lang}
        t={t}
        orientation={orientation}
        done={done}
        onToggleDone={toggleDone}
        recipes={recipesById}
        onOpenRef={(refId, needed) =>
          navigate(`/recipe/${refId}`, new URLSearchParams({ servings: String(needed) }))
        }
      />

      {modified && (
        <p style={{ marginTop: 20 }}>
          <button
            className="btn small danger"
            onClick={() => {
              if (confirm(t('recipe.confirmRevert')))
                dispatch({ type: 'revert', id: recipe.id })
            }}
          >
            {t('recipe.revert')}
          </button>
        </p>
      )}

      {sharing && (
        <Suspense fallback={null}>
          <ShareDialog
            recipe={recipe}
            multiplier={multiplier}
            servings={effectiveServings}
            orientation={orientation}
            onClose={() => setSharing(false)}
          />
        </Suspense>
      )}
    </>
  )
}
