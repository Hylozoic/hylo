const SELECTION_CLEAR_DEBOUNCE_MS = 300
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
  if (active) {
    if (active.closest?.('.PostDetail .ProseMirror, .PostDetail [contenteditable="true"]')) {
      return true
    }
  }
  return isSelectionInPostDetailEditor()
}

/**
 * Returns true when the current selection is inside the post-detail comment composer
 * or an inline comment editor (iOS may drop focus during handle drag).
 */
export function isSelectionInPostDetailEditor () {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false

  let node = sel.anchorNode
  if (!node) return false
  if (node.nodeType === TEXT_NODE) node = node.parentNode
  if (!node || typeof node.closest !== 'function') return false

  const postDetail = document.querySelector('.PostDetail')
  if (!postDetail?.contains(node)) return false

  return !!node.closest('.ProseMirror, [contenteditable="true"], .CommentForm, .CommentFormWrapper')
}

/**
 * Returns true when pull/swipe gesture handlers should not intercept this touch.
 */
export function shouldBailTextSelectionGesture (target) {
  if (isTextInteractionTarget(target)) return true
  if (isCommentComposerTarget(target)) return true
  if (isCommentEditorFocused()) return true
  if (isSelectionInPostDetailEditor()) return true
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
