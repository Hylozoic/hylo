import React from 'react'
import { cn } from 'util/index'
import {
  Bold, Italic, SquareCode, Strikethrough,
  // RiH1, RiH2, RiH3,
  List, ListOrdered,
  IndentIncrease, Code,
  Undo2, Redo2, RemoveFormatting
} from 'lucide-react'
import classes from './HyloEditor.module.scss'

// export function addIframe (editor) {
//   const url = window.prompt('URL of video or content to embed')

//   if (url) {
//     editor.chain().focus().setIframe({ src: url }).run()
//   }
// }

export default function HyloEditorMenuBar ({ editor }) {
  if (!editor) return null

  return (
    <div className={classes.topMenuBar}>
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn({ [classes.isActive]: editor.isActive('bold') })}
      >
        <Bold size={14} className='text-foreground' />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn({ [classes.isActive]: editor.isActive('italic') })}
      >
        <Italic size={14} className='text-foreground' />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={cn({ [classes.isActive]: editor.isActive('strike') })}
      >
        <Strikethrough size={14} className='text-foreground' />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={cn({ [classes.isActive]: editor.isActive('code') })}
      >
        <Code size={14} className='text-foreground' />
      </button>

      <div className={cn('bg-foreground bg-opacity-30 w-px')} />

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn({ [classes.isActive]: editor.isActive('bulletList') })}
      >
        <List size={14} className='text-foreground' />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cn({ [classes.isActive]: editor.isActive('orderedList') })}
      >
        <ListOrdered size={14} className='text-foreground' />
      </button>

      {/* <div className={classes.divider} /> */}

      {/* <button
        onClick={() => editor.chain().focus().setParagraph().run()}
        // className={cn({ isActive: editor.isActive('paragraph') })}
      >
        <VscPreview />
      </button> */}

      {/* <button
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={cn({ isActive: editor.isActive('paragraph') })}
      >
        <RiParagraph />
      </button> */}
      {/* <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={cn({ isActive: editor.isActive('heading', { level: 1 }) })}
      >
        <RiH1 />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={cn({ isActive: editor.isActive('heading', { level: 2 }) })}
      >
        <RiH2 />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={cn({ isActive: editor.isActive('heading', { level: 3 }) })}
      >
        <RiH3 />
      </button> */}
      {/* <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        className={cn({ isActive: editor.isActive('heading', { level: 4 }) })}
      >
        <RiH4 />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
        className={cn({ isActive: editor.isActive('heading', { level: 5 }) })}
      >
        <RiH5 />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
        className={cn({ isActive: editor.isActive('heading', { level: 6 }) })}
      >
        <RiH6 />
      </button> */}

      <div className={cn('bg-foreground bg-opacity-30 w-px')} />

      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={cn({ [classes.isActive]: editor.isActive('blockquote') })}
      >
        <IndentIncrease size={14} className='text-foreground' />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={cn({ [classes.isActive]: editor.isActive('codeBlock') })}
      >
        <SquareCode size={14} className='text-foreground' />
      </button>
      {/* <button onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <RiSeparator />
      </button> */}
      {/* <button onClick={() => editor.chain().focus().setHardBreak().run()}>
        <RiTextWrap />
      </button> */}

      {/* <button
        onClick={() => addIframe(editor)}
      >
        <RiFilmLine />
      </button> */}

      <div className={cn('bg-foreground bg-opacity-30 w-px')} />

      <button onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={14} className='text-foreground' />
      </button>

      <button onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={14} className='text-foreground' />
      </button>

      <button onClick={() => {
        editor.chain().focus().clearNodes().run()
        editor.chain().focus().unsetAllMarks().run()
      }}
      >
        <RemoveFormatting size={14} className='text-foreground' />
      </button>
    </div>
  )
}
