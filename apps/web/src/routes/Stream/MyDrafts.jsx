import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { FilePenLine, MessageSquare } from 'lucide-react'
import { stripHtml } from 'hooks/useDraftStorage'
import { cn } from 'util/index'

const DRAFT_EVENT = 'hylo:drafts-changed'

const STORAGE_PREFIX = 'draft:'

// Walks localStorage and normalizes any draft payloads (post, modal, chat) into a
// single array the UI can consume. This supports legacy string payloads as well
// as the JSON blobs saved by `useDraftStorage`.
const loadDraftsFromStorage = (groupLookup) => {
  if (typeof window === 'undefined') return []

  const drafts = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key) continue

    const normalizedKey = key.startsWith(STORAGE_PREFIX)
      ? key.slice(STORAGE_PREFIX.length)
      : key

    // Keep support for all the known draft key prefixes emitted by web surfaces
    const keyMatch = normalizedKey.match(/^(chat|post|modal):(.*)$/)
    if (!keyMatch) continue

    const keyType = keyMatch[1]
    const remainder = keyMatch[2]

    if (!remainder) continue

    const rawValue = window.localStorage.getItem(key)
    if (rawValue == null) continue

    let payload
    try {
      payload = JSON.parse(rawValue)
    } catch (err) {
      payload = { details: rawValue }
    }

    if (!payload || typeof payload !== 'object') {
      payload = { details: String(payload || '') }
    }

    const details = typeof payload.details === 'string' ? payload.details : ''
    const title = typeof payload.title === 'string' ? payload.title : ''

    if (!details && !title) continue

    const savedAtValue = payload.savedAt
    const savedAt = typeof savedAtValue === 'number'
      ? savedAtValue
      : savedAtValue
        ? Date.parse(savedAtValue) || 0
        : 0

    if (keyType === 'chat') {
      const parts = remainder.split(':')
      if (parts.length < 3) continue
      const [groupSlugRaw, topicRaw] = parts
      const groupSlug = groupSlugRaw === 'global' ? null : groupSlugRaw
      const topicName = topicRaw === 'default' ? null : topicRaw
      const [mode] = parts.slice(-1)

      const group = groupSlug ? groupLookup[groupSlug] : null
      drafts.push({
        id: key,
        scope: 'chat',
        type: 'chat',
        title: stripHtml(details).slice(0, 80) || 'Untitled chat draft',
        preview: stripHtml(details).slice(0, 140),
        savedAt,
        contextLabel: group ? group.name : groupSlug || 'Chat',
        subLabel: topicName ? `#${topicName}` : undefined,
        navigateTo: `/groups/${groupSlug || ''}/chat/${topicName || ''}`,
        mode
      })
      continue
    }

    let pathWithQuery = remainder
    let mode = ''

    if (keyType === 'modal') {
      const createIndex = remainder.indexOf(':create')
      const editIndex = remainder.indexOf(':edit')
      const modeIndex = createIndex >= 0 ? createIndex : editIndex
      if (modeIndex >= 0) {
        pathWithQuery = remainder.slice(0, modeIndex)
        mode = remainder.slice(modeIndex + 1).split(':')[0] || ''
      }
    } else {
      const newIndex = remainder.indexOf(':new')
      const editIndex = remainder.indexOf(':edit')
      const modeIndex = newIndex >= 0 ? newIndex : editIndex
      if (modeIndex >= 0) {
        pathWithQuery = remainder.slice(0, modeIndex)
        mode = remainder.slice(modeIndex + 1).split(':')[0] || ''
      } else {
        const lastColon = remainder.lastIndexOf(':')
        if (lastColon >= 0) {
          pathWithQuery = remainder.slice(0, lastColon)
          mode = remainder.slice(lastColon + 1)
        }
      }
    }

    if (!pathWithQuery) continue

    const questionIndex = pathWithQuery.indexOf('?')
    const pathname = questionIndex === -1 ? pathWithQuery : pathWithQuery.slice(0, questionIndex)
    const search = questionIndex === -1 ? '' : `?${pathWithQuery.slice(questionIndex + 1)}`

    const segments = pathname.split('/').filter(Boolean)
    let contextLabel = 'My Home'
    if (segments[0] === 'groups' && segments[1]) {
      const groupSlug = segments[1]
      const group = groupLookup[groupSlug]
      contextLabel = group ? group.name : groupSlug
    }

    // Ensure navigation always has a leading slash so the router resolves the draft
    const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`

    drafts.push({
      id: key,
      scope: 'post',
      type: payload.type || 'post',
      title: title || 'Untitled draft',
      preview: stripHtml(details || title).slice(0, 140),
      savedAt,
      contextLabel,
      navigateTo: `${normalizedPathname}${search}`,
      mode
    })
  }

  drafts.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
  return drafts
}

const formatTimestamp = (timestamp, t) => {
  if (!timestamp) return t('Saved just now')
  return new Date(timestamp).toLocaleString()
}

// Renders a single draft summary with type, context, and recent body preview.
// Differentiates between chat and post drafts so the layout mirrors the source surface.
const DraftCard = ({ draft, onOpen }) => {
  const { t } = useTranslation()
  const isChat = draft.type === 'chat'
  const typeLabel = useMemo(() => {
    const typeKey = (draft.type || 'post').toLowerCase()
    const labels = {
      chat: t('Chat'),
      discussion: t('Discussion'),
      event: t('Event'),
      offer: t('Offer'),
      project: t('Project'),
      proposal: t('Proposal'),
      request: t('Request'),
      resource: t('Resource'),
      post: t('Post')
    }
    return labels[typeKey] || typeKey.charAt(0).toUpperCase() + typeKey.slice(1)
  }, [draft.type, t])

  return (
    <button
      onClick={() => onOpen(draft)}
      className='DraftCard text-left w-full rounded-xl border-2 border-foreground/10 bg-card/60 hover:bg-card/90 shadow-md hover:shadow-lg transition-all p-4 flex flex-col gap-2'
    >
      <div className='flex items-center justify-between text-xs uppercase tracking-wide text-foreground/60'>
        <span className='flex items-center gap-2'>
          {isChat ? <MessageSquare className='h-4 w-4 text-foreground/70' /> : <FilePenLine className='h-4 w-4 text-foreground/70' />}
          <span className='flex items-center gap-1'>
            <span className='font-semibold text-foreground/70'>{typeLabel}</span>
            <span className='text-foreground/40'>– {draft.contextLabel}</span>
            {draft.subLabel && <span className='text-foreground/40'>/ {draft.subLabel}</span>}
          </span>
        </span>
        <span>{formatTimestamp(draft.savedAt, t)}</span>
      </div>
      {!isChat && draft.title && (
        <div className='text-base font-semibold text-foreground/90 truncate'>{draft.title}</div>
      )}
      {(draft.preview || (isChat && draft.title)) && (
        <div className={cn('text-sm text-foreground/70 overflow-hidden text-ellipsis', { 'text-base font-medium text-foreground/80': isChat })}>
          {draft.preview || draft.title}
        </div>
      )}
    </button>
  )
}

export default function MyDrafts () {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // Resolve groups once from Redux ORM so we can display friendly names for
  // group-relative drafts without re-running the expensive selection logic on
  // every render.
  const groups = useSelector(state => {
    const orm = state.orm
    const session = orm?.session ? orm.session() : null
    const GroupModel = session?.Group
    if (!GroupModel) return []
    return GroupModel.all().toModelArray()
  }, (prev, next) => {
    if (prev === next) return true
    if (!prev || !next || prev.length !== next.length) return false
    return prev.every((prevGroup, index) => {
      const nextGroup = next[index]
      const prevId = (prevGroup?.ref || prevGroup)?.id
      const nextId = (nextGroup?.ref || nextGroup)?.id
      return prevId === nextId
    })
  })

  // Faster lookup for group slug -> metadata when we hydrate drafts.
  const groupMap = useMemo(() => {
    if (!groups?.length) return {}
    return groups.reduce((acc, groupModel) => {
      const group = groupModel?.ref || groupModel
      if (group?.slug) {
        acc[group.slug] = { id: group.id, name: group.name }
      }
      return acc
    }, {})
  }, [groups])

  const loadDrafts = useCallback(() => loadDraftsFromStorage(groupMap), [groupMap])

  const [drafts, setDrafts] = useState(() => loadDrafts())

  useEffect(() => {
    const sync = () => setDrafts(loadDrafts())
    sync()
    window.addEventListener(DRAFT_EVENT, sync)
    return () => window.removeEventListener(DRAFT_EVENT, sync)
  }, [loadDrafts])

  const handleOpen = useCallback((draft) => {
    navigate(draft.navigateTo)
  }, [navigate])

  const content = useMemo(() => {
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
          <DraftCard key={draft.id} draft={draft} onOpen={handleOpen} />
        ))}
      </div>
    )
  }, [drafts, handleOpen, t])

  return (
    <div className='flex flex-col gap-3'>
      {content}
    </div>
  )
}
