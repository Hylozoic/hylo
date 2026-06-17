const SELECTION_CLEAR_DEBOUNCE_MS = 150

/**
 * Returns true when the user has selected text in the document, a contenteditable,
 * or an input/textarea (window.getSelection() alone misses the latter on iOS).
 */
export function hasActiveTextSelection () {
  const sel = window.getSelection()
  if (sel && sel.toString().length > 0) return true

  const active = document.activeElement
  if (!active) return false

  const tag = active.tagName
  if (tag !== 'TEXTAREA' && tag !== 'INPUT') return false

  const { selectionStart, selectionEnd } = active
  if (selectionStart == null || selectionEnd == null) return false
  return selectionStart !== selectionEnd
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
