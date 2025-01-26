import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// TODO redesign: reverting this. Want a consistent pattern across frontends, to make it simpler for Aaron to make edits
// This is a direct copy, a duplication, of code, that could be rolled into shared directory but I'm not confident about importing dependencies into shared
export function cn (...inputs) {
  return twMerge(clsx(inputs))
}