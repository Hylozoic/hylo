import React, { useEffect, useRef, useState } from 'react'
import {
  Bold, Italic, SquareCode, Strikethrough,
  List, ListOrdered, Link, Unlink,
  IndentIncrease, Code, ImagePlus,
  Undo2, Redo2, RemoveFormatting,
  Heading1, Heading2, Heading3, Video
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

/**
 * Handle adding or updating a video embed
 * Validates YouTube and Vimeo URLs and inserts/updates the video node
 */
function setVideo (editor) {
  const videoSrc = editor.getAttributes('video').src
  const input = window.prompt('Video URL', videoSrc)

  // cancelled
  if (input === null) {
    return
  }

  // empty
  if (input === '') {
    if (editor.isActive('video')) {
      editor.commands.deleteSelection()
    }
    return
  }

  // validate url is from youtube or vimeo
  if (!input.match(/youtube|vimeo/)) {
    return window.alert('Sorry, your video must be hosted on YouTube or Vimeo.')
  }

  // get the src value from embed code if all pasted in
  const srcCheck = input.match(/src="(?<src>.+?)"/)
  let src = srcCheck ? srcCheck.groups.src : input

  // check youtube url is correct
  if (input.match(/youtube/) && !src.match(/^https:\/\/www\.youtube\.com\/embed\//)) {
    // try to convert regular youtube url to embed url
    const youtubeMatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    if (youtubeMatch) {
      src = `https://www.youtube.com/embed/${youtubeMatch[1]}`
    } else {
      return window.alert('Sorry, your YouTube URL should be a valid YouTube video URL.')
    }
  }

  // check vimeo url is correct
  if (input.match(/vimeo/) && !src.match(/^https:\/\/player\.vimeo\.com\/video\//)) {
    // try to convert regular vimeo url to embed url
    const vimeoMatch = src.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) {
      src = `https://player.vimeo.com/video/${vimeoMatch[1]}`
    } else {
      return window.alert('Sorry, your Vimeo URL should be a valid Vimeo video URL.')
    }
  }

  if (editor.isActive('video')) {
    editor.commands.updateAttributes('video', { src })
  } else {
    editor.chain().focus().insertContent(`<video data-type="embed" src="${src}"></video>`).run()
  }
}

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

      {extendedMenu && (
        <HyloEditorMenuBarButton
          Icon={Video}
          onClick={() => setVideo(editor)}
        />
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
