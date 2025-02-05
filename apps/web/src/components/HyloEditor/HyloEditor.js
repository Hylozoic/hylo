import React, { useRef, useImperativeHandle, useEffect, useState } from 'react'
import { cn } from 'util/index'
import { useTranslation } from 'react-i18next'
import { useEditor, EditorContent, Extension, BubbleMenu } from '@tiptap/react'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { ScanEye } from 'lucide-react'
import Link from '@tiptap/extension-link'
import PeopleMentions from './extensions/PeopleMentions'
import TopicMentions from './extensions/TopicMentions'
import HyloEditorMenuBar from './HyloEditorMenuBar'
import 'tippy.js/dist/tippy.css'
import classes from './HyloEditor.module.scss'

const HyloEditor = React.forwardRef(({
  className,
  containerClassName = 'hyloEditor',
  contentHTML,
  // See: https://github.com/Hylozoic/hylo-evo/issues/1318
  groupIds,
  maxSuggestions = 7,
  onAddLink,
  onAddMention,
  onAddTopic,
  onCreate = () => {},
  onUpdate,
  onEnter,
  onEscape,
  placeholder,
  readOnly,
  showMenu = false,
  suggestionsThemeName = 'suggestions'
}, ref) => {
  const { t } = useTranslation()
  const editorRef = useRef(null)
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
          HTMLAttributes: {
            target: null
          },
          validate: href => {
            onAddLink && onAddLink(href)
            return true
          }
        }
      }
    }),

    PeopleMentions({ onSelection: onAddMention, maxSuggestions, groupIds, suggestionsThemeName }),

    TopicMentions({ onSelection: onAddTopic, maxSuggestions, groupIds, suggestionsThemeName }),

    Highlight
  ]

  const editor = useEditor({
    content: contentHTML,
    extensions,
    onCreate,
    onUpdate: ({ editor }) => {
      if (!onUpdate) return
      onUpdate(editor.getHTML())
    }
  })

  // Dynamic setting of initial editor content
  useEffect(() => {
    if (editor.isInitialized) {
      editor.commands.setContent(contentHTML)
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

    editor.setEditable(!readOnly)
  }, [groupIds, readOnly])

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
        editorRef.current.commands.focus(position)
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
        <HyloEditorMenuBar editor={editor} />
      )}
      <EditorContent className={cn('text-foreground py-3 px-3')} editor={editor} />
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
