import { useEffect, useState, type InputHTMLAttributes } from 'react'

/**
 * A box that holds what you type, not the value it stands for. Writing the parsed value
 * straight back into a controlled input made clearing a field impossible: an empty box
 * parses as nothing, so it was clamped to the minimum on the spot, and the next digit
 * landed after it — clear `5` to type `1`, get `11`.
 *
 * Here the text is free while you type. Every keystroke that parses is committed, so
 * the recipe still updates live; leaving the field with something unparseable puts the
 * last committed value back, rather than the minimum.
 */
export function useCommittedText<T>(
  value: T,
  format: (value: T) => string,
  parse: (text: string) => T | null,
  onCommit: (value: T) => void,
  same: (a: T, b: T) => boolean = Object.is,
) {
  const [text, setText] = useState(() => format(value))

  // Adopt a change from elsewhere (undo, another recipe) — but not one this box made
  // itself, or every keystroke would rewrite the text and move the caret. Keyed on the
  // formatted value, so a value rebuilt as a fresh object each render is not a change.
  const key = format(value)
  useEffect(() => {
    const mine = parse(text)
    if (mine === null || !same(mine, value)) setText(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `text` is the thing being reconciled
  }, [key])

  return {
    value: text,
    setText,
    onChange: (e: { target: { value: string } }) => {
      setText(e.target.value)
      const parsed = parse(e.target.value)
      if (parsed !== null && !same(parsed, value)) onCommit(parsed)
    },
    onBlur: () => {
      const parsed = parse(text)
      setText(format(parsed ?? value))
    },
  }
}

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'min' | 'max'
> & {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

/**
 * A number that is never empty. Out-of-range input is held back while typing (a `0`
 * on the way to `0.5` must not be refused) and clamped when the field is left.
 */
export function NumberField({ value, onChange, min, max, onBlur, ...rest }: Props) {
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
  const parseLive = (text: string) => {
    const n = parseNumber(text)
    return n !== null && n === clamp(n) ? n : null
  }
  const box = useCommittedText(value, String, parseLive, onChange)
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={box.value}
      onChange={box.onChange}
      onBlur={(e) => {
        const n = parseNumber(box.value)
        const next = n === null ? value : clamp(n)
        if (next !== value) onChange(next)
        box.setText(String(next))
        onBlur?.(e)
      }}
    />
  )
}

/** Accepts a decimal comma as well, since half the cooks typing here are French. */
export function parseNumber(text: string): number | null {
  const s = text.trim().replace(',', '.')
  if (s === '' || !/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null
  return Number(s)
}
