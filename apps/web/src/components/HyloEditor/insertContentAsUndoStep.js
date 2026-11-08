import { closeHistory } from '@tiptap/pm/history'

/**
 * Inserts at the editor's cursor (or replaces the selection) as its own undo step, so Cmd-Z removes
 * just this insert even right after typing (ProseMirror otherwise groups edits made within 500ms).
 */
export default function insertContentAsUndoStep (editor, content) {
  editor.chain()
    .focus()
    .command(({ tr }) => {
      closeHistory(tr)
      return true
    })
    .insertContent(content)
    .run()
}
