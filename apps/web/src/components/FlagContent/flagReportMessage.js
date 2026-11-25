// Joins group names the way the current language lists things.
function formatGroupNames (groupNames, language) {
  const names = [...new Set((groupNames || []).map(name => (name || '').trim()).filter(Boolean))]
  if (names.length === 0) return ''
  const locale = language || 'en'
  if (typeof Intl !== 'undefined' && typeof Intl.ListFormat === 'function') {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)
  }
  return names.join(', ')
}

// The confirmation shown after a flag is submitted, naming the post's groups.
export function flagReportMessage (t, language, groupNames) {
  const groups = formatGroupNames(groupNames, language)
  if (!groups) return t('Your report has been sent to moderators')
  return t('Your report has been sent to moderators of the {{groups}}', { groups })
}
