/**
 * What a signed-out visitor may learn about a post they can't see: only that it
 * exists, plus the name, avatar and slug of a group it's in whose About page is
 * already public. Nothing is said about Protected or Hidden groups, and a space
 * only counts when both it and its parent group are Public.
 */
export default async function postTeaser (id) {
  const notFound = { exists: false, group: null }
  if (!id || !/^\d+$/.test(String(id))) return notFound

  const post = await Post.where({ id, active: true }).fetch()
  if (!post || post.get('type') === Post.Type.THREAD) return notFound

  const groups = await post.groups().fetch({ withRelated: ['parentGroup'] })
  const models = groups.models
  if (models.length === 0) return notFound

  const isPublic = group => !!group && group.get('active') && group.get('visibility') === Group.Visibility.PUBLIC
  const aboutIsPublic = group => {
    if (!isPublic(group)) return false
    // A space (groups.parent_id set) only counts when its parent group is Public too
    if (!group.get('parent_id') && group.get('type') !== 'space') return true
    const parent = group.relations.parentGroup
    return !!(parent && parent.id) && isPublic(parent)
  }

  const publicGroup = models
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id))
    .find(aboutIsPublic)

  return {
    exists: true,
    group: publicGroup
      ? {
          name: publicGroup.get('name'),
          slug: publicGroup.get('slug'),
          avatarUrl: publicGroup.get('avatar_url')
        }
      : null
  }
}
