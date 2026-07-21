import { PAGINATION_TOTAL_COLUMN_NAME } from './applyPagination'

export default function presentQuerySet (models, options, querySetId) {
  // for backwards compatibility
  const limit = options.first || options.limit
  const offset = options.offset || 0

  if (!limit) {
    throw new Error('presentQuerySet needs a "limit" or "first" option')
  }

  var total = 0

  if (options.total != null) {
    total = Number(options.total)
  } else if (options.hasMore != null) {
    total = offset + models.length + (options.hasMore ? 1 : 0)
  } else if (models.length > 0 && typeof models[0].get === 'function') {
    total = Number(models[0].get(PAGINATION_TOTAL_COLUMN_NAME))
  }

  return {
    id: querySetId || null,
    total,
    hasMore: options.hasMore != null ? options.hasMore : offset + limit < total,
    items: models
  }
}
