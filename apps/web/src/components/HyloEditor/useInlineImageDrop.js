import { useEffect, useRef } from 'react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import useUploadFiles from 'hooks/useUploadFiles'
import { FILESTACK_ACCEPTED_MIME_TYPES_BY_ATTACHMENT_TYPE } from 'client/filestack'
import {
  dataTransferHasFiles,
  filesFromClipboard,
  filesFromDataTransfer,
  partitionFiles
} from 'util/droppedFiles'

const inlineImageDropKey = new PluginKey('hyloInlineImageDrop')

/**
 * For editors with the extended toolbar (page and welcome views): images
 * dropped or pasted into the editor are uploaded like the toolbar's Image
 * button and inserted where they were dropped (or at the cursor for a paste).
 * Other files are ignored, as the toolbar only inserts images.
 */
export default function useInlineImageDrop (editor, { type, id, enabled }) {
  const uploadFiles = useUploadFiles({ type, id })
  const uploadFilesRef = useRef(uploadFiles)
  uploadFilesRef.current = uploadFiles

  useEffect(() => {
    if (!editor || editor.isDestroyed || !enabled) return

    const insertImages = (files, startPos) => {
      const { accepted } = partitionFiles(files, { accept: FILESTACK_ACCEPTED_MIME_TYPES_BY_ATTACHMENT_TYPE.image })
      if (accepted.length === 0) return

      // Keep the insert position pointing at the same place while uploads run,
      // even if the content before it changes in the meantime
      let pos = startPos
      const trackPosition = ({ transaction }) => {
        pos = transaction.mapping.map(pos)
      }
      editor.on('transaction', trackPosition)

      uploadFilesRef.current(accepted, attachment => {
        if (editor.isDestroyed) return
        const at = Math.min(pos, editor.state.doc.content.size)
        editor.chain().insertContentAt(at, {
          type: 'image',
          attrs: { src: attachment.url, alt: attachment.filename, title: attachment.filename }
        }).run()
      }).finally(() => editor.off('transaction', trackPosition))
    }

    const plugin = new Plugin({
      key: inlineImageDropKey,
      props: {
        handleDrop (view, event, _slice, moved) {
          if (moved || !dataTransferHasFiles(event.dataTransfer)) return false
          event.preventDefault()
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
          insertImages(filesFromDataTransfer(event.dataTransfer), coords ? coords.pos : view.state.selection.to)
          return true
        },
        handlePaste (view, event) {
          const files = filesFromClipboard(event.clipboardData)
          if (files.length === 0) return false
          event.preventDefault()
          insertImages(files, view.state.selection.to)
          return true
        }
      }
    })

    editor.registerPlugin(plugin)
    return () => {
      if (!editor.isDestroyed) editor.unregisterPlugin(inlineImageDropKey)
    }
  }, [editor, enabled])
}
