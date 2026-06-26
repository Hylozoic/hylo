const SELECTION_CLEAR_DEBOUNCE_MS = 300
const TEXT_NODE = 3

const READABLE_CONTENT_SELECTOR = '.global-postContent, .PostDetail, .ChatPost_container, .ChatRoom, .ProseMirror, [contenteditable="true"], textarea, input'

/**
 * Returns true when the user has selected text in the document, a contenteditable,
 * or an input/textarea (window.getSelection() alone misses the latter on iOS).
 */
export function hasActiveTextSelection () {
  const sel = window.getSelection()
  if (sel) {
    if (sel.toString().length > 0) return true
    if (sel.rangeCount > 0 && !sel.isCollapsed) return true
  }

  const active = document.activeElement
  if (!active) return false

  const tag = active.tagName
  if (tag === 'TEXTAREA' || tag === 'INPUT') {
    const { selectionStart, selectionEnd } = active
    if (selectionStart != null && selectionEnd != null) {
      return selectionStart !== selectionEnd
    }
  }

  if (active.isContentEditable && sel?.rangeCount > 0 && !sel.isCollapsed) {
    const anchorNode = sel.anchorNode
    if (anchorNode && active.contains(anchorNode.nodeType === TEXT_NODE ? anchorNode.parentNode : anchorNode)) {
      return true
    }
  }

  return false
}

/**
 * Returns true when touches on this element should not be hijacked by nav/swipe gestures.
 */
export function isTextInteractionTarget (el) {
  if (!el || typeof el.closest !== 'function') return false
  if (el.isContentEditable) return true

  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'INPUT') return true

  return !!el.closest('.ProseMirror, [contenteditable="true"]')
}

/**
 * Returns true for static readable surfaces (chat posts, post body, comment text).
 */
export function isReadableContentTarget (el) {
  if (!el || typeof el.closest !== 'function') return false
  return !!el.closest(READABLE_CONTENT_SELECTOR)
}

/**
 * Returns true when the current selection anchor is inside readable post/message content.
 */
export function hasReadableContentSelection () {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false

  let node = sel.anchorNode
  if (!node) return false
  if (node.nodeType === TEXT_NODE) node = node.parentNode
  if (!node || typeof node.closest !== 'function') return false

  return !!node.closest(READABLE_CONTENT_SELECTOR)
}

/**
 * Returns true when pull/swipe gesture handlers should not intercept this touch.
 */
export function shouldBailTextSelectionGesture (target) {
  if (isTextInteractionTarget(target)) return true
  if (isReadableContentTarget(target)) return true
  if (hasActiveTextSelection()) return true
  if (hasReadableContentSelection()) return true
  return false
}

/**
 * Tracks text selection across iOS quirks (temporary empty getSelection during handle drag).
 * @param {Object} options
 * @param {Function} options.getActiveTouch - Returns true while a gesture touch is in progress
 */
export function createPersistentSelectionTracker ({ getActiveTouch = () => false } = {}) {
  let persistentHasSelection = false
  let clearSelectionTimer = null

  const onSelectionChange = () => {
    if (hasActiveTextSelection() || hasReadableContentSelection()) {
      persistentHasSelection = true
      if (clearSelectionTimer) {
        clearTimeout(clearSelectionTimer)
        clearSelectionTimer = null
      }
      return
    }

    if (getActiveTouch()) return

    if (clearSelectionTimer) clearTimeout(clearSelectionTimer)
    clearSelectionTimer = setTimeout(() => {
      if (!hasActiveTextSelection() && !hasReadableContentSelection() && !getActiveTouch()) {
        persistentHasSelection = false
      }
      clearSelectionTimer = null
    }, SELECTION_CLEAR_DEBOUNCE_MS)
  }

  document.addEventListener('selectionchange', onSelectionChange)

  return {
    get hasSelection () {
      return persistentHasSelection || hasActiveTextSelection() || hasReadableContentSelection()
    },
    clearIfGone () {
      if (!hasActiveTextSelection() && !hasReadableContentSelection()) {
        persistentHasSelection = false
      }
    },
    destroy () {
      if (clearSelectionTimer) clearTimeout(clearSelectionTimer)
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  }
}
