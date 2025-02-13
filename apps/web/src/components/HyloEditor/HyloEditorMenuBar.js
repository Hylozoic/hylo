import React, { useState } from 'react'
import {
  Bold, Italic, SquareCode, Strikethrough,
  // RiH1, RiH2, RiH3,
  List, ListOrdered, Link, Unlink,
  IndentIncrease, Code,
  Undo2, Redo2, RemoveFormatting
} from 'lucide-react'
import { Button } from 'components/ui/button'
import { cn } from 'util/index'

// export function addIframe (editor) {
//   const url = window.prompt('URL of video or content to embed')

//   if (url) {
//     editor.chain().focus().setIframe({ src: url }).run()
//   }
// }

export default function HyloEditorMenuBar ({ editor }) {
  if (!editor) return null

  const [modal, setModal] = useState(false)

  return (
    <div className='flex items-center w-full opacity-70 hover:opacity-100 transition-all'>
      <HyloEditorMenuBarButton
        Icon={Bold}
        setModal={setModal}
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
      />
      <HyloEditorMenuBarButton
        Icon={Italic}
        setModal={setModal}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
      />

      <HyloEditorMenuBarButton
        Icon={Strikethrough}
        setModal={setModal}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
      />

      <HyloEditorMenuBarButton
        Icon={Code}
        setModal={setModal}
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
      />

      <div className='relative inline-block'>
        {editor.isActive('link')
          ? (
            <button
              className='text-md rounded p-2 transition-all duration-250 ease-in-out hover:bg-foreground/10 cursor-pointer'
              title='Remove link'
              onClick={() => editor.chain().focus().unsetLink().run()}
            >
              <Unlink size={14} />
            </button>)
          : (
            <button
              tabIndex='-1'
              title='Add a link'
              onClick={() => setModal(!modal)}
              className='text-md rounded p-2 transition-all duration-250 ease-in-out hover:bg-foreground/10 cursor-pointer'
            >
              <Link size={14} />
            </button>)}
        <AddLinkBox editor={editor} setModal={setModal} isOpen={modal} />
      </div>

      <div className={cn('bg-foreground bg-opacity-30 w-px')} />

      <HyloEditorMenuBarButton
        Icon={List}
        setModal={setModal}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
      />

      <HyloEditorMenuBarButton
        Icon={ListOrdered}
        setModal={setModal}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
      />

      <div className={cn('bg-foreground bg-opacity-30 w-px')} />

      <HyloEditorMenuBarButton
        Icon={IndentIncrease}
        setModal={setModal}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
      />

      <HyloEditorMenuBarButton
        Icon={SquareCode}
        setModal={setModal}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
      />

      <div className={cn('bg-foreground bg-opacity-30 w-px')} />

      <HyloEditorMenuBarButton
        Icon={Undo2}
        setModal={setModal}
        onClick={() => editor.chain().focus().undo().run()}
      />

      <HyloEditorMenuBarButton
        Icon={Redo2}
        setModal={setModal}
        onClick={() => editor.chain().focus().redo().run()}
      />

      <HyloEditorMenuBarButton
        Icon={RemoveFormatting}
        setModal={setModal}
        onClick={() => {
          editor.chain().focus().clearNodes().run()
          editor.chain().focus().unsetAllMarks().unsetBold().unsetItalic().unsetStrike().unsetCode().unsetBulletList().unsetOrderedList().unsetBlockquote().unsetCodeBlock().run()
        }}
      />
    </div>
  )
}

function HyloEditorMenuBarButton ({ active, Icon, onClick, setModal }) {
  return (
    <button
      tabIndex='-1'
      onClick={() => { setModal(false); onClick() }}
      className={cn(
        'text-md rounded p-2 transition-all duration-250 ease-in-out hover:bg-foreground/10 cursor-pointer',
        { 'bg-foreground/10': active }
      )}
    >
      <Icon className='text-foreground w-4 h-4' />
    </button>
  )
}

export const AddLinkBox = ({ editor, setModal, isOpen }) => {
  const [linkInput, setLinkInput] = useState('')
  const [container, setContainer] = useState(null)

  if (!isOpen) return null

  const handleLinkChange = (e) => {
    setLinkInput(e.target.value)
  }

  const setLink = (input) => {
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: input })
      .run()
  }

  const handleSubmit = (e, link) => {
    e.preventDefault()
    setLink(linkInput)
    setModal(false)
    setLinkInput('')
  }

  return (
    <div className='absolute z-50 bg-popover rounded-md p-4 shadow-md'>
      <div className='modal'>
        <button onClick={() => setModal(false)} className='absolute top-1 right-1'>
          x
        </button>
        <form
          onSubmit={(e) => handleSubmit(e)}
          className='flex flex-col gap-1 items-center'
        >
          <label className='text-popover-foreground'>Add link</label>
          <input className='bg-input' autoFocus onChange={(e) => handleLinkChange(e)} />
          <Button onClick={() => handleSubmit}>
            Add
          </Button>
        </form>
      </div>
    </div>
  )
}
