import { chain, isEmpty, times } from 'lodash'

export default function (term, qb, { columns }) {
  const query = chain(term.split(/\s*\s/)) // split on whitespace
    .map(word => word.replace(/[,;|:&()!\\]+/g, ''))
    .reject(isEmpty)
    .map(word => word + ':*') // add prefix matching
    .join(' & ') // build the tsquery string using logical AND operands
    .value()

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
