import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { FilePenLine, MessageSquare, MessageCircle, Trash2 } from 'lucide-react'
import { stripHtml } from 'hooks/useDraft'
import { cn } from 'util/index'
import { deleteDraft, fetchMyDrafts, removeDraft } from 'store/actions/draftActions'
import { selectDraftsForMyDraftsPage } from 'store/selectors/getDrafts'
import getMe from 'store/selectors/getMe'
import { removeCreateEditModalFromUrl } from '@hylo/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'components/ui/dialog'
import Button from 'components/ui/button'

const formatTimestamp = (timestamp, t) => {
  if (!timestamp) return t('Saved just now')
  return new Date(timestamp).toLocaleString()
}

/**
 * Parses the JSON data field from a server draft and returns a displayable payload.
 */
const parseDraftData = (rawData) => {
  if (!rawData) return {}
  try {
    return typeof rawData === 'string' ? JSON.parse(rawData) : rawData
  } catch {
    return { details: rawData }
  }
}

/**
 * Renders a single draft summary with type, context, and recent body preview.
 */
const DraftCard = ({ draft, onOpen, onDelete, currentUserId }) => {
  const { t } = useTranslation()

  const payload = useMemo(() => parseDraftData(draft.data), [draft.data])

  const isChat = draft.type === 'chat'
  const isComment = draft.type === 'comment'
  const isMessage = draft.type === 'message'

  const typeLabel = useMemo(() => {
    const postType = payload.type || draft.type || 'post'
    const key = postType.toLowerCase()
    const labels = {
      chat: t('Chat'),
      comment: t('Comment'),
      discussion: t('Discussion'),
      event: t('Event'),
      message: t('Message'),
      offer: t('Offer'),
      project: t('Project'),
      proposal: t('Proposal'),
      request: t('Request'),
      resource: t('Resource'),
      post: t('Post')
    }
    return labels[key] || key.charAt(0).toUpperCase() + key.slice(1)
  }, [payload.type, draft.type, t])

  const title = payload.title || ''
  const details = payload.details || payload.html || payload.text || ''
  const preview = stripHtml(details).slice(0, 140)
  const displayTitle = title || (isChat || isComment || isMessage ? '' : t('Untitled draft'))

  const contextLabel = useMemo(() => {
    if (draft.group?.name) return draft.group.name
    if (isMessage) {
      const participants = draft.messageThread?.participants
      const participantList = typeof participants?.toModelArray === 'function'
        ? participants.toModelArray()
        : (participants || [])
      const participantNames = participantList
        .filter(person => String(person?.id || '') !== String(currentUserId || ''))
        .map(person => person?.name)
        .filter(Boolean)
      if (participantNames.length > 0) return participantNames.join(', ')
      return t('Direct Message')
    }
    if (isComment && draft.post?.id) return t('Comment on post')
    return t('My Home')
  }, [draft.group, draft.messageThread, draft.post, isMessage, isComment, t])

  const icon = isChat || isMessage
    ? <MessageSquare className='h-4 w-4 text-foreground/70' />
    : isComment
      ? <MessageCircle className='h-4 w-4 text-foreground/70' />
      : <FilePenLine className='h-4 w-4 text-foreground/70' />

  return (
    <div
      role='button'
      tabIndex={0}
      onClick={() => onOpen(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(draft)
        }
      }}
      className='DraftCard group text-left w-full rounded-xl border-2 border-foreground/10 bg-card/60 hover:bg-card/90 shadow-md hover:shadow-lg transition-all p-4 flex flex-col gap-2 relative cursor-pointer'
    >
      <div className='flex items-center justify-between text-xs uppercase tracking-wide text-foreground/60'>
        <span className='flex items-center gap-2'>
          {icon}
          <span className='flex items-center gap-1'>
            <span className='font-semibold text-foreground/70'>{typeLabel}</span>
            <span className='text-foreground/40'>– {contextLabel}</span>
          </span>
        </span>
        <span>{formatTimestamp(draft.updatedAt, t)}</span>
      </div>
      {displayTitle && (
        <div className='text-base font-semibold text-foreground/90 truncate'>{displayTitle}</div>
      )}
      {preview && (
        <div className={cn('text-sm text-foreground/70 overflow-hidden text-ellipsis', { 'text-base font-medium text-foreground/80': isChat || isMessage })}>
          {preview}
        </div>
      )}
      <button
        type='button'
        aria-label={t('Delete draft')}
        className='absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1.5 bg-background/90 hover:bg-background border border-foreground/20'
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDelete(draft)
        }}
      >
        <Trash2 className='h-4 w-4 text-foreground/70' />
      </button>
    </div>
  )
}

/** Fetches the user's drafts from the server and renders the list. */
export default function MyDrafts () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const drafts = useSelector(selectDraftsForMyDraftsPage)
  const currentUser = useSelector(getMe)
  const [loading, setLoading] = useState(true)
  const [deletingDraft, setDeletingDraft] = useState(null)

  const loadDrafts = useCallback(async () => {
    try {
      await dispatch(fetchMyDrafts())
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[MyDrafts] fetch drafts failed:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  useEffect(() => {
    loadDrafts()

    // Re-fetch when a draft is saved or deleted elsewhere on the page
    const handleDraftsChanged = () => loadDrafts()
    window.addEventListener('hylo:drafts-changed', handleDraftsChanged)
    return () => window.removeEventListener('hylo:drafts-changed', handleDraftsChanged)
  }, [loadDrafts])

  const handleOpen = useCallback((draft) => {
    if (draft.navigateTo) {
      const url = new URL(draft.navigateTo, window.location.origin)
      // Opening from My Drafts should keep you on the destination context after posting.
      // Replace any stale closePath with the non-modal destination for this URL.
      url.searchParams.delete('closePath')
      // navigateTo is often pathname-only; PostEditor defaults newPostType to discussion without this.
      if (draft.type === 'post' && !draft.isEdit) {
        const payload = parseDraftData(draft.data)
        const effectivePostType = draft.postType || payload.type
        if (effectivePostType) {
          url.searchParams.set('newPostType', effectivePostType)
        }
      }
      const nextUrl = `${url.pathname}${url.search}`
      const closePath = removeCreateEditModalFromUrl(nextUrl) || url.pathname
      url.searchParams.set('closePath', closePath)
      url.searchParams.set('sourceDraftId', String(draft.id))
      navigate(`${url.pathname}${url.search}${url.hash}`)
    }
  }, [navigate])

  const handleDeleteRequest = useCallback((draft) => {
    setDeletingDraft(draft)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingDraft?.id) return
    try {
      await dispatch(deleteDraft(deletingDraft.id))
      dispatch(removeDraft(deletingDraft.id))
      window.dispatchEvent(new Event('hylo:drafts-changed'))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[MyDrafts] delete draft failed:', err)
      }
    } finally {
      setDeletingDraft(null)
    }
  }, [deletingDraft?.id, dispatch])

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className='text-sm text-foreground/60 border-2 border-foreground/10 rounded-xl p-6 bg-card/50 shadow-inner'>
          {t('Loading drafts...')}
        </div>
      )
    }

    if (!drafts.length) {
      return (
        <div className='text-sm text-foreground/60 border-2 border-foreground/10 rounded-xl p-6 bg-card/50 shadow-inner'>
          {t('drafts-empty-message')}
        </div>
      )
    }

    return (
      <div className='flex flex-col gap-3'>
        {drafts.map(draft => (
          <DraftCard key={draft.id} draft={draft} onOpen={handleOpen} onDelete={handleDeleteRequest} currentUserId={currentUser?.id} />
        ))}
      </div>
    )
  }, [currentUser?.id, drafts, handleDeleteRequest, handleOpen, loading, t])

  return (
    <div className='flex flex-col gap-3'>
      {content}
      <Dialog open={!!deletingDraft} onOpenChange={(open) => !open && setDeletingDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Really delete this draft?')}</DialogTitle>
            <DialogDescription>{t('This can’t be undone.')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeletingDraft(null)}>
              {t('Cancel')}
            </Button>
            <Button variant='destructive' onClick={handleDeleteConfirm}>
              {t('Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
