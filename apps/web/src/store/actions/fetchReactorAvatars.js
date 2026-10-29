export const FETCH_REACTOR_AVATARS = 'FETCH_REACTOR_AVATARS'

// Reaction fragments only carry each reactor's id and name. The reactions drawer
// fetches avatars for the people it lists when it opens, in one aliased query.
export const MAX_REACTOR_AVATARS = 100

export default function fetchReactorAvatars (personIds = []) {
  const ids = personIds.slice(0, MAX_REACTOR_AVATARS)
  const variableDefinitions = ids.map((_, i) => `$id${i}: ID`).join(', ')
  const fields = ids.map((_, i) => `p${i}: person(id: $id${i}) { id avatarUrl }`).join('\n')

  return {
    type: FETCH_REACTOR_AVATARS,
    graphql: {
      query: `query ReactorAvatars (${variableDefinitions}) {\n${fields}\n}`,
      variables: Object.fromEntries(ids.map((id, i) => [`id${i}`, id]))
    }
  }
}
