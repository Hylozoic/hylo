const SELECTION_CLEAR_DEBOUNCE_MS = 150
const TEXT_NODE = 3

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
 * Returns true for the post-detail comment composer (including iOS selection handles
 * that may not register as ProseMirror touch targets).
 */
export function isCommentComposerTarget (el) {
  if (!el || typeof el.closest !== 'function') return false
  return !!el.closest('.CommentForm, .CommentFormWrapper')
}

/**
 * Returns true when a HyloEditor inside post detail is focused (reply box or inline edit).
 */
export function isCommentEditorFocused () {
  const active = document.activeElement
  if (!active) return false
  return !!active.closest?.('.PostDetail .ProseMirror, .PostDetail [contenteditable="true"]')
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
    if (hasActiveTextSelection()) {
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
      if (!hasActiveTextSelection() && !getActiveTouch()) {
        persistentHasSelection = false
      }
      clearSelectionTimer = null
    }, SELECTION_CLEAR_DEBOUNCE_MS)
  }

  document.addEventListener('selectionchange', onSelectionChange)

  return {
    get hasSelection () {
      return persistentHasSelection || hasActiveTextSelection()
    },
    clearIfGone () {
      if (!hasActiveTextSelection()) persistentHasSelection = false
    },
    destroy () {
      if (clearSelectionTimer) clearTimeout(clearSelectionTimer)
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  }
}
