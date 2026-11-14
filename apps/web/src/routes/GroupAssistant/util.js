const escapeHtml = text => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

/**
 * A plain-text draft as the HTML a post or comment stores: one paragraph per
 * blank-line-separated block, with single line breaks kept. Everything is
 * escaped, so a draft can never carry markup.
 */
export function draftAsHtml (text) {
  return String(text || '')
    .trim()
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/**
 * "Only stewards see this: Maria, Priya, and you". Uses first names, puts the
 * viewer last as "you", and counts the rest past three names.
 */
export function stewardNamesLine (stewards, currentUserId, t) {
  const others = (stewards || []).filter(steward => String(steward.id) !== String(currentUserId))
  const includesMe = others.length !== (stewards || []).length
  const first = name => String(name || '').trim().split(/\s+/)[0]
  const names = others.slice(0, 3).map(steward => first(steward.name)).filter(Boolean)
  const more = others.length - names.length
  if (more > 0) names.push(t('{{count}} more', { count: more }))
  if (includesMe) names.push(t('you'))
  if (names.length === 0) return t('Only stewards see this')
  const list = names.length <= 2 ? names.join(` ${t('and')} `) : `${names.slice(0, -1).join(', ')}, ${t('and')} ${names[names.length - 1]}`
  return t('Only stewards see this: {{names}}', { names: list })
}
