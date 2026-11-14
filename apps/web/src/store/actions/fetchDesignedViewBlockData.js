export const FETCH_DESIGNED_VIEW_BLOCK_DATA = 'FETCH_DESIGNED_VIEW_BLOCK_DATA'

const postFields = `
  id
  title
  type
  createdAt
  startTime
  endTime
  timezone
  location
  commentsTotal
  creator {
    id
    name
    avatarUrl
  }
`

/**
 * Loads what a live block of a designed view shows (see DesignedViewHelpers in
 * @hylo/shared): a group's recent posts, its upcoming events, or its members.
 *
 * The result is read from the action's response (payload.data.group) and is
 * not written to the ORM: these are small read-only lists, and each block of
 * a page asks for its own.
 */
export default function fetchDesignedViewBlockData (groupSlug, block) {
  const first = block.limit
  let query, variables

  if (block.type === 'members') {
    query = `query DesignedViewMembers ($slug: String, $first: Int) {
      group(slug: $slug) {
        id
        memberCount
        members(first: $first) {
          items {
            id
            name
            avatarUrl
            tagline
          }
        }
      }
    }`
    variables = { slug: groupSlug, first }
  } else if (block.type === 'events') {
    query = `query DesignedViewEvents ($slug: String, $first: Int, $afterTime: Date) {
      group(slug: $slug) {
        id
        posts(first: $first, types: ["event"], afterTime: $afterTime, sortBy: "start_time", order: "asc") {
          items {${postFields}}
        }
      }
    }`
    variables = { slug: groupSlug, first, afterTime: new Date().toISOString() }
  } else {
    query = `query DesignedViewPosts ($slug: String, $first: Int, $types: [String], $search: String) {
      group(slug: $slug) {
        id
        posts(first: $first, types: $types, search: $search, sortBy: "created", order: "desc") {
          items {${postFields}}
        }
      }
    }`
    // An empty list means every type; chats are left out because they are not standalone posts
    const types = block.postTypes?.length > 0
      ? block.postTypes
      : ['discussion', 'event', 'offer', 'project', 'proposal', 'request', 'resource']
    variables = { slug: groupSlug, first, types, search: block.search || null }
  }

  return {
    type: FETCH_DESIGNED_VIEW_BLOCK_DATA,
    graphql: { query, variables },
    meta: { groupSlug, blockType: block.type }
  }
}
