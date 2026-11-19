// A track's outline is an ordered list of top-level items. Each item is either
// an action or a module, and a module holds its own ordered actions (one level
// only: modules don't nest). A track is complete when every action in it is
// complete, wherever it sits.
//
// Items look like:
//   { kind: 'action', id, post }
//   { kind: 'module', id, module, posts }
//
// The server sends the pieces separately: a view's collectionPosts (every
// action, in the flat order of the whole track) and its trackModules (each
// with postIds and `index`, the module's position in the top-level list).

const str = id => String(id)

/** Builds the top-level outline from a track-actions view's posts and modules. */
export function buildOutline (posts, trackModules) {
  const allPosts = posts || []
  const modules = trackModules || []
  const postsById = new Map(allPosts.map(post => [str(post.id), post]))
  const inModule = new Set()

  const moduleItems = [...modules]
    .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity) || (a.order ?? 0) - (b.order ?? 0))
    .map(trackModule => {
      const modulePosts = []
      ;(trackModule.postIds || []).forEach(postId => {
        const post = postsById.get(str(postId))
        if (!post || inModule.has(str(postId))) return
        inModule.add(str(postId))
        modulePosts.push(post)
      })
      return { kind: 'module', id: str(trackModule.id), module: trackModule, posts: modulePosts }
    })

  const actionItems = allPosts
    .filter(post => !inModule.has(str(post.id)))
    .map(post => ({ kind: 'action', id: str(post.id), post }))

  // Modules take the slot their index names (or the nearest free one), and the
  // actions outside any module fill the remaining slots in order.
  const total = moduleItems.length + actionItems.length
  const slots = new Array(total).fill(null)
  moduleItems.forEach(item => {
    let slot = Math.min(Math.max(item.module.index ?? total, 0), total - 1)
    while (slot < total && slots[slot]) slot++
    if (slot >= total) {
      slot = total - 1
      while (slots[slot]) slot--
    }
    slots[slot] = item
  })
  let nextAction = 0
  return slots.map(slot => slot || actionItems[nextAction++])
}

/** Every action in order, with the module item it sits in (or null). */
export function flattenOutline (items) {
  const flat = []
  items.forEach(item => {
    if (item.kind === 'action') flat.push({ post: item.post, moduleItem: null })
    else item.posts.forEach(post => flat.push({ post, moduleItem: item }))
  })
  return flat
}

export function outlineProgress (items) {
  const flat = flattenOutline(items)
  return { done: flat.filter(({ post }) => !!post.completedAt).length, total: flat.length }
}

/** 1-based position of a module among the track's modules. */
export function moduleNumber (items, moduleId) {
  return items.filter(item => item.kind === 'module').findIndex(item => item.id === str(moduleId)) + 1
}

/**
 * Whether a module's actions can be opened yet. A module is open unless it has
 * an opening date that hasn't arrived, or it opens after the previous module
 * and that module isn't finished.
 * Returns { locked: false } or { locked: true, reason: 'date', opensAt } or
 * { locked: true, reason: 'previous', previousNumber }.
 */
export function moduleLock (items, moduleItem, now = new Date()) {
  if (!moduleItem) return { locked: false }
  const { opensAt, opensAfterPrevious } = moduleItem.module
  if (opensAt && new Date(opensAt) > now) {
    return { locked: true, reason: 'date', opensAt: new Date(opensAt) }
  }
  if (opensAfterPrevious) {
    const moduleItems = items.filter(item => item.kind === 'module')
    const position = moduleItems.findIndex(item => item.id === moduleItem.id)
    const previous = moduleItems[position - 1]
    if (previous && !previous.posts.every(post => !!post.completedAt)) {
      return { locked: true, reason: 'previous', previousNumber: position }
    }
  }
  return { locked: false }
}

/** The first action that isn't complete and whose module is open. */
export function currentAction (items, now = new Date()) {
  const lockByModule = new Map()
  const hit = flattenOutline(items).find(({ post, moduleItem }) => {
    if (post.completedAt) return false
    if (!moduleItem) return true
    if (!lockByModule.has(moduleItem.id)) lockByModule.set(moduleItem.id, moduleLock(items, moduleItem, now).locked)
    return !lockByModule.get(moduleItem.id)
  })
  return hit || null
}

/** The outline in the shape the updateTrackOutline mutation takes. */
export function outlineToInput (items) {
  return items.map(item => item.kind === 'module'
    ? { moduleId: item.id, postIds: item.posts.map(post => str(post.id)) }
    : { postId: item.id })
}

/**
 * Moves an action or a module to a drop target and returns the new outline.
 *
 * dragged: { kind: 'action' | 'module', id }
 * target, one of:
 *   { type: 'action', id }      on an action: go right before it. A dragged action
 *                               joins that action's module; a dragged module goes
 *                               before the module the action is in.
 *   { type: 'module', id }      on a module's header: an action goes to the end of
 *                               that module, a module goes right before it.
 *   { type: 'module-end', id }  the end of a module (actions only).
 *   { type: 'end' }             the end of the top level.
 * Returns the same array when nothing changes.
 */
export function moveOutlineItem (items, dragged, target) {
  if (!dragged || !target) return items
  const draggedId = str(dragged.id)
  const targetId = target.id != null ? str(target.id) : null

  if (dragged.kind === 'module') {
    const moving = items.find(item => item.kind === 'module' && item.id === draggedId)
    if (!moving) return items
    const rest = items.filter(item => item !== moving)
    let before = null
    if (target.type === 'module') {
      if (targetId === draggedId) return items
      before = rest.find(item => item.kind === 'module' && item.id === targetId)
    } else if (target.type === 'action') {
      // An action inside a module stands for that module
      before = rest.find(item => item.kind === 'module'
        ? item.posts.some(post => str(post.id) === targetId)
        : item.id === targetId)
    } else if (target.type !== 'end') {
      return items
    }
    const position = before ? rest.indexOf(before) : rest.length
    return [...rest.slice(0, position), moving, ...rest.slice(position)]
  }

  if (target.type === 'action' && targetId === draggedId) return items
  const flat = flattenOutline(items).find(({ post }) => str(post.id) === draggedId)
  if (!flat) return items
  const post = flat.post

  // Take the action out of wherever it is
  const rest = items
    .filter(item => !(item.kind === 'action' && item.id === draggedId))
    .map(item => item.kind === 'module' && item.posts.some(p => str(p.id) === draggedId)
      ? { ...item, posts: item.posts.filter(p => str(p.id) !== draggedId) }
      : item)

  const intoModule = (moduleItem, beforePostId) => rest.map(item => {
    if (item !== moduleItem) return item
    const position = beforePostId == null ? -1 : item.posts.findIndex(p => str(p.id) === beforePostId)
    const posts = [...item.posts]
    posts.splice(position < 0 ? posts.length : position, 0, post)
    return { ...item, posts }
  })

  if (target.type === 'module' || target.type === 'module-end') {
    const moduleItem = rest.find(item => item.kind === 'module' && item.id === targetId)
    return moduleItem ? intoModule(moduleItem, null) : items
  }

  if (target.type === 'action') {
    const moduleItem = rest.find(item => item.kind === 'module' && item.posts.some(p => str(p.id) === targetId))
    if (moduleItem) return intoModule(moduleItem, targetId)
    const position = rest.findIndex(item => item.kind === 'action' && item.id === targetId)
    if (position < 0) return items
    return [...rest.slice(0, position), { kind: 'action', id: draggedId, post }, ...rest.slice(position)]
  }

  if (target.type === 'end') return [...rest, { kind: 'action', id: draggedId, post }]
  return items
}

/**
 * Turns an outline back into the two lists stored on the view: collectionPosts
 * in flat order, and trackModules with their index and postIds.
 */
export function outlineToViewFields (items) {
  return {
    collectionPosts: flattenOutline(items).map(({ post }) => post),
    trackModules: items
      .map((item, index) => item.kind === 'module'
        ? { ...item.module, index, postIds: item.posts.map(post => str(post.id)) }
        : null)
      .filter(Boolean)
  }
}

/**
 * Applies an outline in mutation-input shape (see outlineToInput) to a view's
 * stored posts and modules. Posts and modules the input leaves out go last.
 */
export function applyOutlineInput (posts, trackModules, inputItems) {
  const postsById = new Map((posts || []).map(post => [str(post.id), post]))
  const modulesById = new Map((trackModules || []).map(m => [str(m.id), m]))
  const usedPosts = new Set()
  const usedModules = new Set()
  const take = postId => {
    const post = postsById.get(str(postId))
    if (!post || usedPosts.has(str(postId))) return null
    usedPosts.add(str(postId))
    return post
  }

  const items = []
  ;(inputItems || []).forEach(input => {
    if (input.moduleId != null) {
      const trackModule = modulesById.get(str(input.moduleId))
      if (!trackModule || usedModules.has(str(input.moduleId))) return
      usedModules.add(str(input.moduleId))
      items.push({ kind: 'module', id: str(trackModule.id), module: trackModule, posts: (input.postIds || []).map(take).filter(Boolean) })
    } else if (input.postId != null) {
      const post = take(input.postId)
      if (post) items.push({ kind: 'action', id: str(post.id), post })
    }
  })
  ;(trackModules || []).forEach(trackModule => {
    if (!usedModules.has(str(trackModule.id))) {
      items.push({ kind: 'module', id: str(trackModule.id), module: trackModule, posts: (trackModule.postIds || []).map(take).filter(Boolean) })
    }
  })
  ;(posts || []).forEach(post => {
    if (!usedPosts.has(str(post.id))) items.push({ kind: 'action', id: str(post.id), post })
  })

  return outlineToViewFields(items)
}
