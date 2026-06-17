import React, { useRef, useImperativeHandle, useEffect, useState } from 'react'
import { cn } from 'util/index'
import { useTranslation } from 'react-i18next'
import { useEditor, EditorContent, Extension, BubbleMenu } from '@tiptap/react'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import StarterKit from '@tiptap/starter-kit'
import { ScanEye } from 'lucide-react'
import Link from '@tiptap/extension-link'
import PeopleMentions from './extensions/PeopleMentions'
import TopicMentions from './extensions/TopicMentions'
import Video from './extensions/Video'
import HyloEditorMenuBar from './HyloEditorMenuBar'
import { hasActiveTextSelection } from 'util/textSelectionTouch'
import 'tippy.js/dist/tippy.css'
import classes from './HyloEditor.module.scss'

const EDITOR_SCROLL_BLUR_THRESHOLD_PX = 15

const HyloEditor = React.forwardRef(({
  className,
  containerClassName = 'hyloEditor',
  contentHTML,
  // See: https://github.com/Hylozoic/hylo-evo/issues/1318
  groupIds,
  maxSuggestions = 7,
  menuClassName = '',
  onAddLink,
  onAddMention,
  onAddTopic,
  onCreate = () => {},
  onUpdate,
  onEnter,
  onAltEnter,
  onEscape,
  onFocus,
  onBlur,
  placeholder,
  readOnly,
  showMenu = false,
  extendedMenu = false,
  suggestionsThemeName = 'suggestions',
  type = 'post' // Used for the image uploader to know what type of content it's uploading
}, ref) => {
  const { t } = useTranslation()
  const editorRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const persistentSelectionRef = useRef(false)
  const selectionClearTimerRef = useRef(null)
  const [initialized, setInitialized] = useState(false)
  const [selectedLink, setSelectedLink] = useState()

  const extensions = [
    // Key events respond are last extension first, these will be last
    Extension.create({
      name: 'KeyboardShortcuts',
      // Keep around for debugging for now:
      // onTransaction: ({ editor, transaction }) => {
      //   console.log('!!!!! looking how to get all link marks', transaction)
      //   transactions.doc.node.forEach(child => {
      //     const [fontSizeMark] = child.marks.filter((m: Mark) => m.type === markType)
      //    })
      // },
      addKeyboardShortcuts () {
        return {
          'Alt-Enter': () => {
            if (!onAltEnter) return false
            return onAltEnter(editor.getHTML())
          },
          Enter: ({ editor }) => {
            if (!onEnter) return false
            return onEnter(editor.getHTML())
          },
          Escape: () => {
            if (!onEscape) return false
            return onEscape()
          }
        }
      }
    }),

    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      }
    }),

    Placeholder.configure({ placeholder }),

    Image.configure({
      allowBase64: true,
      HTMLAttributes: {
        class: 'w-full h-auto'
      }
    }),

    Link.extend({
      inclusive: false, // Link doesnt extend as you keep typing text
      // This expands concatenated links back to full href for editing
      parseHTML () {
        return [
          {
            tag: 'a',
            // Special handling for links who's innerHTML has been concatenated by the backend
            contentElement: element => {
              if (element.innerHTML.match(/…$/)) {
                const href = element.getAttribute('href')

                try {
                  const url = new URL(href)
                  element.innerHTML = `${url.hostname}${url.pathname !== '/' ? url.pathname : ''}`
                  return element
                } catch (e) {
                  element.innerHTML = href
                  return element
                }
              }

              return element
            }
          }
        ]
      },
      addOptions () {
        return {
          ...this.parent?.(),
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: {
            target: null
          },
          isAllowedUri: (url, ctx) => {
            onAddLink && onAddLink(url)
            return true
          }
        }
      }
    }),

    PeopleMentions({ onSelection: onAddMention, maxSuggestions, groupIds, suggestionsThemeName }),

    TopicMentions({ onSelection: onAddTopic, maxSuggestions, groupIds, suggestionsThemeName }),

    Highlight,

    Video
  ]

  const onEditorSelectionChange = () => {
    if (hasActiveTextSelection()) {
      persistentSelectionRef.current = true
      if (selectionClearTimerRef.current) {
        clearTimeout(selectionClearTimerRef.current)
        selectionClearTimerRef.current = null
      }
      return
    }

    if (selectionClearTimerRef.current) clearTimeout(selectionClearTimerRef.current)
    selectionClearTimerRef.current = setTimeout(() => {
      if (!hasActiveTextSelection()) persistentSelectionRef.current = false
      selectionClearTimerRef.current = null
    }, 150)
  }

  const onEditorTouchStart = (e) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const onEditorTouchMove = (e) => {
    if (persistentSelectionRef.current || hasActiveTextSelection()) return

    const touch = e.touches[0]
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x)
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y)

    // Hide the keyboard when vertically scrolling the page — not when selecting text
    if (deltaY > EDITOR_SCROLL_BLUR_THRESHOLD_PX && deltaY > deltaX * 1.5) {
      editorRef.current?.commands.blur()
    }
  }

  const editor = useEditor({
    content: contentHTML,
    extensions,
    onCreate: ({ editor }) => {
      if (onCreate) onCreate({ editor })
    },
    onUpdate: ({ editor }) => {
      // Don't call onUpdate until the editor is full initialized (including initial content added)
      if (!onUpdate || !initialized) return
      onUpdate(editor.getHTML())
    },
    onFocus: () => {
      document.addEventListener('touchstart', onEditorTouchStart, { passive: true })
      document.addEventListener('touchmove', onEditorTouchMove, { passive: true })
      document.addEventListener('selectionchange', onEditorSelectionChange)
      if (onFocus) {
        onFocus()
      }
    },
    onBlur: () => {
      document.removeEventListener('touchstart', onEditorTouchStart)
      document.removeEventListener('touchmove', onEditorTouchMove)
      document.removeEventListener('selectionchange', onEditorSelectionChange)
      if (selectionClearTimerRef.current) {
        clearTimeout(selectionClearTimerRef.current)
        selectionClearTimerRef.current = null
      }
      persistentSelectionRef.current = false
      if (onBlur) {
        onBlur()
      }
    },
    editorProps: {
      transformPastedHTML (html) {
        if (type === 'post') {
          // Remove any images copied any pasted as HTML
          return html.replace(/<img.*?>/g, '') // remove any images copied any pasted as HTML
        }
        return html
      }
    }
  })

  // Dynamic setting of initial editor content, and setting the initialized state
  useEffect(() => {
    if (editor.isInitialized) {
      editor.commands.setContent(contentHTML)
      setInitialized(true)
    }
  }, [editor?.isInitialized, contentHTML])

  // Dynamic placeholder text
  useEffect(() => {
    if (editor !== null && placeholder !== '') {
      editor.extensionManager.extensions.filter(
        extension => extension.name === 'placeholder'
      )[0].options.placeholder = placeholder
      editor.view.dispatch(editor.state.tr)
    }
  }, [editor, placeholder])

  useEffect(() => {
    if (!editor) return
    if (groupIds) editor.extensionStorage.mention.groupIds = groupIds
  }, [groupIds])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
  }, [readOnly])

  useImperativeHandle(ref, () => ({
    blur: () => {
      editorRef.current.commands.blur()
    },
    clearContent: () => {
      // `true` here means it will emit an `onUpdate`
      editorRef.current.commands.clearContent(true)
    },
    focus: position => {
      if (editorRef.current) {
        editorRef.current.commands.focus(position || 'start')
      }
    },
    getHTML: () => {
      return editorRef.current.getHTML()
    },
    getText: () => {
      return editorRef.current.getText()
    },
    isEmpty: () => {
      return editorRef.current ? editorRef.current.isEmpty : true
    },
    setContent: content => {
      editorRef.current.commands.setContent(content)
    }
  }))

  const shouldShowBubbleMenu = ({ editor }) => {
    if (onAddLink && editor.isActive('link')) {
      setSelectedLink(editor.getAttributes('link'))

      return true
    }
  }

  if (!editor) return null

  editorRef.current = editor

  return (
    <div className={cn('flex-1', containerClassName)}>
      {showMenu && (
        <HyloEditorMenuBar editor={editor} extendedMenu={extendedMenu} type={type} id={groupIds?.[0]} className={menuClassName} />
      )}
      <EditorContent className={cn('HyloEditor_EditorContent1 global-postContent text-foreground py-3 px-3', className)} editor={editor} />
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{
            duration: 100,
            arrow: true,
            hideOnClick: true,
            placement: 'bottom',
            offset: [0, 6]
          }}
          shouldShow={shouldShowBubbleMenu}
        >
          <span
            onClick={() => {
              onAddLink(selectedLink?.href, true)
            }}
            className={classes.addLinkPreviewButton}
          >
            <ScanEye size={14} /> {t('Add Preview')}
          </span>
        </BubbleMenu>
      )}
    </div>
  )
})

export default HyloEditor
