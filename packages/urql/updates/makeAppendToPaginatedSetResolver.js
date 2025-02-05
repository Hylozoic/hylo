import { PAGINATION_ARGS } from '../resolvers/makePaginationResolver'

/*
  Adds a newly created entity (e.g., a message or comment) to the correct paginated set in the URQL cache.

  This function updates the cached pagination results for a given field on a parent entity (e.g., `messages` on a `MessageThread`).
  It ensures that the new item is only added to the appropriate page(s) based on the existing pagination order:

  - **"desc" order** → Prepends the item to the first page (newest-first pagination).
  - **"asc" order** → Appends the item to the last page (oldest-first pagination).
  - **Handles multiple paginated sets** by respecting non-pagination query arguments.
  - **Avoids duplicate entries** and unnecessary updates.

  If no paginated sets exist, the function does nothing and allows URQL to handle the new entity normally.

  @param {Object} options - Configuration options
  @param {string} options.parentType - The type of the parent entity (e.g., "MessageThread" or "Post").
  @param {Function} options.parentIdGetter - Function to extract the parent ID from mutation arguments.
  @param {string} options.fieldName - The name of the paginated field to update (e.g., "messages" or "comments").
*/

export default function makeAppendToPaginatedSetResolver ({
  parentType = 'Query',
  parentId: providedParentId,
  parentIdGetter,
  fieldName,
  newItem: providedNewItem,
  newItemGetter
}) {
  return (result, args, cache, info) => {
    const newItem = providedNewItem || newItemGetter
      ? newItemGetter(result)
      : result?.[info.fieldName]
    if (!newItem) return

    const parentId = providedParentId || (parentIdGetter ? parentIdGetter(args) : null)

    // Allows null parentId, useful only for Query
    const parentKey = parentId
      ? cache.keyOfEntity({ __typename: parentType, id: parentId })
      : parentType

    // Get all cached paginated sets for this field (e.g. messages, comments, or childComments)
    const paginatedFields = cache.inspectFields(parentKey).filter(fi => fi.fieldName === fieldName)

    if (paginatedFields.length > 0) {
      // **Step 1: Group sets by unique args (excluding pagination params)**
      const uniqueSets = new Map()

      paginatedFields.forEach(field => {
        const filteredArgs = Object.fromEntries(
          Object.entries(field.arguments || {}).filter(([key]) => !PAGINATION_ARGS.includes(key))
        )

        const argsKey = cache.keyOfField(field.fieldName, filteredArgs)
        if (!uniqueSets.has(argsKey)) {
          uniqueSets.set(argsKey, { order: field.arguments?.order || 'desc', pages: [] })
        }
        uniqueSets.get(argsKey).pages.push(field)
      })
      // **Step 2: Iterate over unique sets and update each correctly according to order arg **
      uniqueSets.forEach(({ order, pages }) => {
        // First for "desc", last for "asc"
        const targetPage = order === 'desc' ? pages[0] : pages[pages.length - 1]

        if (!targetPage) return

        const newItemKey = cache.keyOfEntity(newItem)
        const paginatedSetKey = cache.resolve(parentKey, targetPage.fieldKey)

        if (paginatedSetKey) {
          const items = cache.resolve(paginatedSetKey, 'items') || []
          const updatedItems = order === 'desc'
            ? [newItemKey, ...items]
            : [...items, newItemKey]
          cache.link(paginatedSetKey, 'items', updatedItems)
        }
      })
    }
  }
}

// An implementation which doesn't address ordering (assumes desc) or uniq arg sets, but is easier to grok:
// export function makeAppendToPaginatedSetResolver ({ parentType, fieldName, parentId: providedParentId, parentIdGetter }) {
//   return function (result, args, cache, info) {
//     const parentId = providedParentId || parentIdGetter(args)

//     if (parentId) {
//       const newItem = result?.[info.fieldName]

//       if (!newItem) return

//       const parentKey = cache.keyOfEntity({ __typename: parentType, id: parentId })
//       const pageFields = cache.inspectFields(parentKey).filter(fi => fi.fieldName === fieldName)

//       if (pageFields.length > 0) {
//         const { fieldKey } = pageFields[0]
//         const targetPageKey = cache.resolve(parentKey, fieldKey)

//         if (targetPageKey) {
//           const items = cache.resolve(targetPageKey, 'items') || []
//           const newItemKey = cache.keyOfEntity(newItem)

//           const updatedItems = [newItemKey, ...items]

//           // Link the updated items array back to the target field
//           cache.link(targetPageKey, 'items', updatedItems)
//         }
//       }
//     }
//   }
// }
