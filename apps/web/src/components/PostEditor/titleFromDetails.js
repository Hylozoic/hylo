import { TextHelpers } from '@hylo/shared'

// The longest title the composer accepts
export const AUTO_TITLE_LENGTH = 80

/**
 * A title made from the start of a post's text: HTML stripped, whitespace
 * collapsed, and cut at a word boundary with an ellipsis so the result is
 * never longer than maxLength. Returns '' when there is no text.
 * The server fills untitled discussions the same way
 * (apps/backend/api/models/post/titleFromDetails.js).
 */
export default function titleFromDetails (html, maxLength = AUTO_TITLE_LENGTH) {
  const text = TextHelpers.presentHTMLToText(html || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut
  return base.replace(/[\s.,;:!?-]+$/, '') + '…'
}

/** Discussions may be posted without a title; every other type needs one. */
export function isTitleOptional (postType) {
  return postType === 'discussion'
}
