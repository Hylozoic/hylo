import React from 'react'
import { Undo2, Redo2, RemoveFormatting } from 'lucide-react'
import classes from './HyloEditor.module.scss'

export default function HyloEditorBottomMenuBar ({ editor }) {
  if (!editor) return null

  return (
    <div className={classes.bottomMenuBar}>
      <button onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={14} />
      </button>
      <button onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={14} />
      </button>
      {/* <button onClick={() => editor.chain().focus().unsetAllMarks().run()}>
        clear formatting in selection
      </button> */}
      <button onClick={() => editor.chain().focus().clearNodes().run()}>
        <RemoveFormatting size={14} />
      </button>
    </div>
  )
}
