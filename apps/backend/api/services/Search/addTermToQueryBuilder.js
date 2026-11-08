import { times } from 'lodash'
import prefixTsQuery from './prefixTsQuery'

export default function (term, qb, { columns }) {
  const query = prefixTsQuery(term, { splitWords: true })

  // A term with no usable words (only whitespace or punctuation) adds no filter
  if (!query) return

  const statement = columns
    .map(col => `(to_tsvector('english', ${col}) @@ to_tsquery(?))`)
    .join(' or ')

  const values = times(columns.length, () => query)

  qb.where(function () {
    this.whereRaw(`(${statement})`, values)
  })
}
