export const SLUG_MAX_LENGTH = 40

export const slugValidatorRegex = /^[0-9a-z-]{2,40}$/

// Derives a group handle from a group name. Punctuation is dropped
// rather than glued to its neighbours, and runs of hyphens are collapsed so
// "Bay & Delta  Watershed!" becomes "bay-delta-watershed".
export function nameToSlug (name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, '')
}
