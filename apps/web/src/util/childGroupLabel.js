/**
 * Names where a child post lives: "in GroupName", or when the post belongs to
 * several groups, "in GroupName and N others". The named group prefers the
 * space, matching how the stream detects child-space posts; a child post's
 * groups never include the group being viewed.
 */
export default function childGroupLabel (post, t) {
  const groups = post?.groups || []
  const primary = groups.find(g => g.type === 'space') || groups[0]
  if (!primary?.name) return null
  const others = groups.length - 1
  if (others <= 0) return t('in {{groupName}}', { groupName: primary.name })
  if (others === 1) return t('in {{groupName}} and 1 other', { groupName: primary.name })
  return t('in {{groupName}} and {{count}} others', { groupName: primary.name, count: others })
}
