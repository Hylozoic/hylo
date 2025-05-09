import React, { useEffect, useRef, useState } from 'react'
import {
  Bold, Italic, SquareCode, Strikethrough,
  List, ListOrdered, Link, Unlink,
  IndentIncrease, Code, ImagePlus,
  Undo2, Redo2, RemoveFormatting,
  Heading1, Heading2, Heading3
} from 'lucide-react'
import Button from 'components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from 'components/ui/popover'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { cn } from 'util/index'

// export function addIframe (editor) {
//   const url = window.prompt('URL of video or content to embed')

//   if (url) {
//     editor.chain().focus().setIframe({ src: url }).run()
//   }
// }

export default function HyloEditorMenuBar ({ className, editor, extendedMenu, type, id }) {
  const [linkModalOpen, setLinkModalOpen] = useState(false)

  if (!editor) return null

  return (
    <div className={cn('flex items-center w-full opacity-70 hover:opacity-100 transition-all flex-wrap', className)}>
      {extendedMenu && (
        <HyloEditorMenuBarButton
          Icon={Heading1}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
        />
      )}
      {extendedMenu && (
        <HyloEditorMenuBarButton
          Icon={Heading2}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { lebel: 2 })}
        />
      )}
      {extendedMenu && (
        <HyloEditorMenuBarButton
          Icon={Heading3}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
        />
      )}
      <HyloEditorMenuBarButton
        Icon={Bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
      />
      <HyloEditorMenuBarButton
        Icon={Italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
      />

      <HyloEditorMenuBarButton
        Icon={Strikethrough}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        hideOnMobile
      />

      <HyloEditorMenuBarButton
        Icon={Code}
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        hideOnMobile
      />

      <div className='relative inline-block hidden xs:block'>
        {editor.isActive('link')
          ? (
            <button
              className='text-md rounded p-2 transition-all duration-250 ease-in-out hover:bg-foreground/10 cursor-pointer'
              title='Remove link'
              onClick={() => editor.chain().focus().unsetLink().run()}
              tabIndex='-1'
            >
              <Unlink size={14} />
            </button>)
          : (
            <Popover onOpenChange={(v) => setLinkModalOpen(v)} open={linkModalOpen}>
              <PopoverTrigger asChild>
                <button
                  tabIndex='-1'
                  title='Add a link'
                  onClick={() => setLinkModalOpen(!linkModalOpen)}
                  className='text-md rounded p-2 transition-all duration-250 ease-in-out hover:bg-foreground/10 cursor-pointer'
                >
                  <Link size={14} />
                </button>
              </PopoverTrigger>
              <PopoverContent side='right' align='start' className='!p-0 !w-[340px]'>
                <AddLinkBox editor={editor} setLinkModalOpen={setLinkModalOpen} isOpen={linkModalOpen} />
              </PopoverContent>
            </Popover>)}
      </div>

      {extendedMenu && (
        <UploadAttachmentButton
          type={type}
          id={id}
          attachmentType='image'
          onSuccess={(attachment) => editor.commands.setImage({
            src: attachment.url,
            alt: attachment.filename,
            title: attachment.filename
          })}
          allowMultiple
        >
          <HyloEditorMenuBarButton Icon={ImagePlus} />
        </UploadAttachmentButton>
      )}

      <div className={cn('bg-foreground bg-opacity-30 w-px')} />

      <HyloEditorMenuBarButton
        Icon={List}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
      />

      <HyloEditorMenuBarButton
        Icon={ListOrdered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
      />

      <div className={cn('bg-foreground bg-opacity-30 w-px')} />

      <HyloEditorMenuBarButton
        Icon={IndentIncrease}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
      />

      <HyloEditorMenuBarButton
        Icon={SquareCode}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        hideOnMobile
      />

      <div className={cn('bg-foreground bg-opacity-30 w-px')} />

      <HyloEditorMenuBarButton
        Icon={Undo2}
        onClick={() => editor.chain().focus().undo().run()}
      />

      <HyloEditorMenuBarButton
        Icon={Redo2}
        onClick={() => editor.chain().focus().redo().run()}
      />

      <HyloEditorMenuBarButton
        Icon={RemoveFormatting}
        onClick={() => {
          editor.chain().focus().clearNodes().unsetAllMarks().run()
        }}
      />
    </div>
  )
}

function HyloEditorMenuBarButton ({ active, Icon, onClick, hideOnMobile = false }) {
  return (
    <button
      tabIndex='-1'
      onClick={onClick}
      className={cn(
        'text-md rounded p-2 transition-all duration-250 ease-in-out hover:bg-foreground/10 cursor-pointer',
        { 'bg-foreground/10': active },
        { 'hidden xs:block': hideOnMobile }
      )}
    >
      <Icon className='text-foreground w-4 h-4' />
    </button>
  )
}

export const AddLinkBox = ({ editor, setLinkModalOpen, isOpen }) => {
  const [linkInput, setLinkInput] = useState('')
  const linkFieldRef = useRef()

  useEffect(() => {
    if (isOpen && linkFieldRef.current) {
      linkFieldRef.current.focus()
    }
  }, [isOpen])

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
    setLinkModalOpen(false)
    setLinkInput('')
  }

  return (
    <div className={cn('bg-popover rounded-md p-4 shadow-md')}>
      <div className='modal'>
        <button onClick={() => setLinkModalOpen(false)} className='absolute top-2 right-2'>
          x
        </button>
        <form
          onSubmit={(e) => handleSubmit(e)}
          className='flex flex-col gap-1 items-center'
        >
          <label className='text-popover-foreground'>Add link</label>
          <input className='w-full bg-input p-2' onChange={(e) => handleLinkChange(e)} ref={linkFieldRef} />
          <Button onClick={() => handleSubmit}>
            Add
          </Button>
        </form>
      </div>
    </div>
  )
}
