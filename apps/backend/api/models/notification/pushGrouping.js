// How pushes look and stack on the phone (D42). One helper for every push sender, so
// new notices group the same way.
//
//   heading     the group or space name
//   groupKey    stacks a group's pushes together in the tray (iOS thread_id, Android
//               android_group). A space stacks with its parent group.
//   collapseKey a later push with the same key replaces the earlier one (collapse_id).
//               Only chat rooms collapse, so a burst from one room replaces itself.
//               Mentions and direct messages never collapse: each one must be seen.
//
// Pass-through only: nothing here is stored.

const get = (model, key) => model && typeof model.get === 'function' ? model.get(key) : model?.[key]

export function groupKeyFor (group) {
  if (!group) return null
  const id = get(group, 'type') === 'space' && get(group, 'parent_id')
    ? get(group, 'parent_id')
    : (group.id || get(group, 'id'))
  return id ? `group-${id}` : null
}

export function chatCollapseKeyFor (group) {
  const id = group && (group.id || get(group, 'id'))
  return id ? `chat-${id}` : null
}

// Options for User#sendPushNotification. `collapse: true` only for chat rooms.
export function pushGroupingFor (group, { collapse = false } = {}) {
  if (!group) return {}
  return {
    heading: get(group, 'name') || null,
    groupKey: groupKeyFor(group),
    collapseKey: collapse ? chatCollapseKeyFor(group) : null
  }
}

// The first line of a post or comment, for 'Name: first line' bodies.
export function firstLine (text, max = 140) {
  const line = String(text || '').split(/\r?\n/).map(l => l.trim()).find(l => l.length > 0) || ''
  return line.length > max ? line.slice(0, max - 1).trimEnd() + '…' : line
}
