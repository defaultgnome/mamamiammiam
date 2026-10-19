import { RATINGS, type Rating } from '../model/types'
import type { Translate } from '../i18n'

export const RATING_ICON: Record<Rating, string> = { like: '♥', superlike: '★' }

/** The title's class: a rated recipe wears its rating as colour, a super like glows. */
export const ratedClass = (rating?: Rating) => (rating ? `rated-${rating}` : undefined)

/** Like / super like toggles; pressing the active one clears the rating. */
export function RatingButtons({
  rating,
  t,
  onChange,
}: {
  rating?: Rating
  t: Translate
  onChange: (rating: Rating | undefined) => void
}) {
  return (
    <div className="seg rating" role="group" aria-label={t('rating.label')}>
      {RATINGS.map((r) => (
        <button
          key={r}
          className={`btn small rate-${r}`}
          aria-pressed={rating === r}
          onClick={() => onChange(rating === r ? undefined : r)}
        >
          {RATING_ICON[r]} {t(`rating.${r}`)}
        </button>
      ))}
    </div>
  )
}
