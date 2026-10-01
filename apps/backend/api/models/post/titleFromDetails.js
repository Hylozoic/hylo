import { TextHelpers } from '@hylo/shared'

// Same length the web composer allows for a typed title
export const AUTO_TITLE_LENGTH = 80

/**
 * A title made from the start of a post's text: HTML stripped, whitespace
 * collapsed, and cut at a word boundary with an ellipsis so the result is
 * never longer than maxLength. Returns '' when there is no text.
 * Keep in step with the web composer's copy (components/PostEditor/titleFromDetails.js).
 */
export default function titleFromDetails (html, maxLength = AUTO_TITLE_LENGTH) {
  const text = TextHelpers.presentHTMLToText(html || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  let cut = text.slice(0, maxLength - 1)
  // Never stop halfway through an emoji or other character that takes two code units
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut
  return base.replace(/[\s.,;:!?-]+$/, '') + '…'
}

/**
 * Discussions may be posted without a title; every other type keeps the title
 * it was given. True when a discussion arrives with an empty title.
 */
export function needsTitleFallback (type, title) {
  return type === 'discussion' && typeof title !== 'undefined' && String(title || '').trim().length === 0
}
