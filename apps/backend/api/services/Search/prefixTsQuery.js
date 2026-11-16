// Characters that are tsquery operators or syntax (quotes, <-> phrase
// operators, :* prefixes, etc.) and so can make to_tsquery throw a syntax error
const TSQUERY_SPECIAL_CHARS = /[,;|:&()!\\#'"<>*]+/g

// Build a to_tsquery string that prefix-matches every word of a user's search
// term, ANDed together: "al bo" -> "al:* & bo:*". Returns '' when the term has
// no usable words, so callers should skip the filter.
//
// By default special characters are dropped from inside a word ("#release!" ->
// "release"). With splitWords they separate words instead, which is what name
// search needs: Postgres indexes "O'Brien" as "o" and "brien", so "o'brien"
// has to become "o:* & brien:*" to match it.
export default function prefixTsQuery (term, { splitWords = false } = {}) {
  return String(term || '')
    .split(/\s+/)
    .map(word => word.replace(TSQUERY_SPECIAL_CHARS, splitWords ? ' ' : ''))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word + ':*')
    .join(' & ')
}
