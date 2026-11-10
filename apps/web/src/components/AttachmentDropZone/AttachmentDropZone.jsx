import React, { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Loader2, Paperclip } from 'lucide-react'
import useUploadFiles from 'hooks/useUploadFiles'
import {
  MAX_FILES_PER_DROP,
  dataTransferHasFiles,
  draggedFilesAreImages,
  filesFromClipboard,
  filesFromDataTransfer,
  partitionFiles
} from 'util/droppedFiles'
import { cn } from 'util/index'

const MESSAGE_TIMEOUT = 5000

/**
 * Wraps a composer (post description, comment, DM or chat box) so images and
 * files dragged onto it, or pasted into it, are uploaded and added as
 * attachments, just like picking them with the upload buttons.
 *
 * Drag and paste events carrying files are handled in the capture phase and
 * stopped there, so the editor inside (TipTap/ProseMirror or a textarea) never
 * inserts them inline and the browser never navigates to a dropped file.
 * Text and link drags and text pastes pass through untouched.
 */
export default function AttachmentDropZone ({
  type,
  id,
  onAttachment,
  onLoadingChange,
  disabled = false,
  maxFiles = MAX_FILES_PER_DROP,
  className,
  children
}) {
  const { t } = useTranslation()
  const uploadFiles = useUploadFiles({ type, id })
  const [dragging, setDragging] = useState(false)
  const [draggingImages, setDraggingImages] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const dragDepth = useRef(0)
  const inFlight = useRef(0)
  const messageTimer = useRef(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(messageTimer.current)
    }
  }, [])

  const showMessage = useCallback(text => {
    clearTimeout(messageTimer.current)
    setMessage(text)
    messageTimer.current = setTimeout(() => mounted.current && setMessage(null), MESSAGE_TIMEOUT)
  }, [])

  const handleFiles = useCallback(async files => {
    const { accepted, rejected } = partitionFiles(files, { maxFiles })
    const reasons = new Set(rejected.map(r => r.reason))

    if (reasons.has('type')) {
      showMessage(t('That type of file can\'t be attached'))
    } else if (reasons.has('size')) {
      showMessage(t('Files must be smaller than 50 MB'))
    } else if (reasons.has('count')) {
      showMessage(t('You can attach up to {{max}} files at a time', { max: maxFiles }))
    } else {
      setMessage(null)
    }

    if (accepted.length === 0) return

    // Several drops can upload at once; report loading until the last one ends
    inFlight.current += 1
    setUploading(true)
    if (inFlight.current === 1) {
      onLoadingChange?.(true, accepted.every(file => file.type.startsWith('image/')) ? 'image' : 'file')
    }
    try {
      const { failed } = await uploadFiles(accepted, onAttachment)
      if (failed.length > 0 && mounted.current) showMessage(t('Upload failed. Please try again.'))
    } finally {
      inFlight.current -= 1
      if (inFlight.current === 0) {
        if (mounted.current) setUploading(false)
        onLoadingChange?.(false)
      }
    }
  }, [maxFiles, onAttachment, onLoadingChange, showMessage, t, uploadFiles])

  const resetDrag = () => {
    dragDepth.current = 0
    setDragging(false)
  }

  // File drags are always claimed, even while disabled, so the editor inside
  // never inserts them and the browser never opens the dropped file instead
  const handleDragEnter = event => {
    if (!dataTransferHasFiles(event.dataTransfer)) return
    event.preventDefault()
    if (disabled) return
    dragDepth.current += 1
    setDraggingImages(draggedFilesAreImages(event.dataTransfer))
    setDragging(true)
  }

  const handleDragOver = event => {
    if (!dataTransferHasFiles(event.dataTransfer)) return
    // preventDefault marks this as a drop target; stopPropagation keeps the
    // editor's own drop cursor and handlers out of it
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
  }

  const handleDragLeave = event => {
    if (!dataTransferHasFiles(event.dataTransfer)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  const handleDrop = event => {
    if (!dataTransferHasFiles(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    resetDrag()
    if (disabled) return
    handleFiles(filesFromDataTransfer(event.dataTransfer))
  }

  const handlePaste = event => {
    const files = filesFromClipboard(event.clipboardData)
    if (files.length === 0) return
    event.preventDefault()
    event.stopPropagation()
    if (disabled) return
    handleFiles(files)
  }

  return (
    <div
      className={cn('relative', className)}
      onDragEnterCapture={handleDragEnter}
      onDragOverCapture={handleDragOver}
      onDragLeaveCapture={handleDragLeave}
      onDropCapture={handleDrop}
      onPasteCapture={handlePaste}
      data-testid='attachment-drop-zone'
    >
      {children}
      {dragging && (
        <div
          className='absolute inset-0 z-50 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-selected bg-background/90 text-foreground text-sm font-bold pointer-events-none'
          data-testid='attachment-drop-zone-overlay'
        >
          {draggingImages ? <ImagePlus className='w-5 h-5' /> : <Paperclip className='w-5 h-5' />}
          {draggingImages ? t('Drop image here') : t('Drop file here')}
        </div>
      )}
      {(uploading || message) && !dragging && (
        <div
          className='absolute right-2 bottom-1 z-40 flex items-center gap-1 rounded-md bg-background/90 px-2 py-0.5 text-xs text-foreground/70 shadow-sm pointer-events-none'
          role='status'
          data-testid='attachment-drop-zone-status'
        >
          {uploading && <Loader2 className='w-3 h-3 animate-spin' />}
          {uploading ? t('Uploading...') : message}
        </div>
      )}
    </div>
  )
}

AttachmentDropZone.propTypes = {
  type: PropTypes.string.isRequired,
  id: PropTypes.string,
  onAttachment: PropTypes.func.isRequired,
  onLoadingChange: PropTypes.func,
  disabled: PropTypes.bool,
  maxFiles: PropTypes.number,
  className: PropTypes.string,
  children: PropTypes.node
}
