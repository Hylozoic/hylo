/* eslint-disable camelcase */

const LIST_KEYS = [
  'discussions',
  'requests',
  'offers',
  'events',
  'projects',
  'resources',
  'proposals',
  'chats',
  'posts_with_new_comments',
  'upcoming',
  'ending',
  'funding_rounds'
]

const POST_LABEL_KEYS = [
  'discussions',
  'requests',
  'offers',
  'events',
  'projects',
  'resources',
  'proposals',
  'posts_with_new_comments',
  'upcoming',
  'ending'
]

/**
 * Combine id lists, keeping the first occurrence of each id.
 */
function unionIds (left, right) {
  const ids = []
  const seen = new Set()
  for (const id of [...(left || []), ...(right || [])]) {
    const key = String(id)
    if (seen.has(key)) continue
    seen.add(key)
    ids.push(id)
  }
  return ids
}

/**
 * Add comments from a second copy of the same post, counting each comment once.
 */
function mergeComments (existing, incoming) {
  const comments = existing.comments ? [...existing.comments] : []
  const seen = new Set(comments.map(comment => String(comment.id)))
  for (const comment of incoming.comments || []) {
    if (comment?.id == null || seen.has(String(comment.id))) continue
    comments.push(comment)
    seen.add(String(comment.id))
  }
  existing.comments = comments
  existing.comment_count = comments.length
}

/**
 * Prefer the parent-group copy when the same post was also attributed to a space.
 * That keeps the link and visibility aligned with a group the recipient belongs to.
 */
function preferParentCopy (existing, incoming) {
  if (incoming.space_id) return
  existing.visible_via_parent = true
  if (incoming.url) existing.url = incoming.url
  delete existing.space_id
  delete existing.space_name
}

/**
 * Combine per-group digest payloads into one, keeping each post and comment once.
 * @param {object[]} datasets Formatted digest data, one object per group
 * @returns {object|null}
 */
export function mergeDigestData (datasets) {
  const lists = (datasets || []).filter(Boolean)
  if (lists.length === 0) return null

  const merged = {}
  const seen = {}
  for (const key of LIST_KEYS) merged[key] = []

  for (const data of lists) {
    for (const key of LIST_KEYS) {
      for (const item of data[key] || []) {
        if (item?.id == null) {
          merged[key].push(item)
          continue
        }
        const mapKey = `${key}:${item.id}`
        const existing = seen[mapKey]
        if (!existing) {
          const copy = {
            ...item,
            posted_in: [...(item.posted_in || [])],
            visible_via_parent: !item.space_id
          }
          if (item.comments) copy.comments = [...item.comments]
          seen[mapKey] = copy
          merged[key].push(copy)
          continue
        }
        existing.posted_in = unionIds(existing.posted_in, item.posted_in)
        if (!item.space_id) preferParentCopy(existing, item)
        if (key === 'posts_with_new_comments') mergeComments(existing, item)
      }
    }
  }

  const byIdDesc = (a, b) => Number(b.id) - Number(a.id)
  for (const key of ['discussions', 'requests', 'offers', 'events', 'projects', 'resources', 'proposals', 'chats', 'posts_with_new_comments', 'funding_rounds']) {
    merged[key].sort(byIdDesc)
  }
  const bySortAt = (a, b) => {
    const aTime = a.sort_at == null ? Number.MAX_SAFE_INTEGER : a.sort_at
    const bTime = b.sort_at == null ? Number.MAX_SAFE_INTEGER : b.sort_at
    return aTime - bTime
  }
  merged.upcoming.sort(bySortAt)
  merged.ending.sort(bySortAt)

  return merged
}

/**
 * "Group Name" or "Group Name / Space Name" for one membership row.
 * @param {{ name?: string, type?: string, parent_name?: string }|undefined} groupRow
 * @returns {string|null}
 */
export function groupLocationLabel (groupRow) {
  if (!groupRow?.name) return null
  if (groupRow.type === 'space' && groupRow.parent_name) {
    return `${groupRow.parent_name} / ${groupRow.name}`
  }
  return groupRow.name
}

/**
 * Comma-separated locations for the groups the user belongs to.
 * @param {Array<string|number>} groupIds
 * @param {Map<string, object>} membershipById
 * @returns {string}
 */
export function groupsLabelFromIds (groupIds, membershipById) {
  const labels = []
  const seen = new Set()
  for (const id of groupIds || []) {
    const label = groupLocationLabel(membershipById.get(String(id)))
    if (!label || seen.has(label)) continue
    seen.add(label)
    labels.push(label)
  }
  labels.sort((a, b) => a.localeCompare(b))
  return labels.join(', ')
}

/**
 * Set groups_label and location_label used by the unified digest template.
 * @param {object} data
 * @param {Map<string, object>} membershipById
 * @returns {object}
 */
export function applyUnifiedGroupLabels (data, membershipById) {
  for (const key of POST_LABEL_KEYS) {
    for (const post of data[key] || []) {
      const label = groupsLabelFromIds(post.posted_in, membershipById)
      if (!label) continue
      post.groups_label = label
      if (key === 'posts_with_new_comments') post.location_label = label
    }
  }
  for (const room of data.chat_rooms || []) {
    const label = groupLocationLabel(membershipById.get(String(room.source_group_id)))
    if (label) room.location_label = label
  }
  return data
}
