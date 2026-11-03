/**
 * Returns the input's new value and caret position after replacing the selection with `text`.
 * A missing selection (e.g. the field was never focused) appends to the end.
 */
export default function insertTextAtSelection (value = '', selectionStart, selectionEnd, text) {
  const start = Number.isInteger(selectionStart) ? selectionStart : value.length
  const end = Number.isInteger(selectionEnd) ? Math.max(selectionEnd, start) : start
  return {
    value: value.slice(0, start) + text + value.slice(end),
    caret: start + text.length
  }
}
