import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Trash2, ExternalLink, Pencil } from 'lucide-react'
import Button from 'components/ui/button'
import CollectionDragHandle from 'components/CollectionDragHandle'
import ProfileLinkIcon from 'components/ProfileLinkIcon'
import { createUserProfileLink, updateUserProfileLink, deleteUserProfileLink, reorderUserProfileLinks } from './ProfileLinksSection.store'

/** Sort profile links by sortOrder, then id. */
function compareProfileLinks (a, b) {
  const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  if (orderDiff !== 0) return orderDiff
  return Number(a.id) - Number(b.id)
}

/** Wraps one profile link so it can be dragged into a new position. */
function SortableProfileLink ({ link, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: String(link.id) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  )
}

export default function ProfileLinksSection ({ profileLinks = [] }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [draftLinks, setDraftLinks] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const sortedLinks = useMemo(() => profileLinks.slice().sort(compareProfileLinks), [profileLinks])
  const links = draftLinks || sortedLinks
  const orderKey = sortedLinks.map(link => `${link.id}:${link.sortOrder ?? 0}`).join('|')

  useEffect(() => {
    setDraftLinks(null)
  }, [orderKey])

  const resetForm = useCallback(() => {
    setUrl('')
    setTitle('')
    setEditingId(null)
    setShowForm(false)
    setLoading(false)
  }, [])

  const handleStartAdd = useCallback(() => {
    setEditingId(null)
    setUrl('')
    setTitle('')
    setShowForm(true)
  }, [])

  const handleStartEdit = useCallback((link) => {
    setEditingId(link.id)
    setUrl(link.url || '')
    setTitle(link.title || '')
    setShowForm(false)
  }, [])

  const handleSaveLink = useCallback(() => {
    if (!url.trim()) return

    setLoading(true)
    const trimmedUrl = url.trim()
    const trimmedTitle = title.trim() || null
    const action = editingId
      ? updateUserProfileLink({ id: editingId, url: trimmedUrl, title: trimmedTitle })
      : createUserProfileLink({ url: trimmedUrl, title: trimmedTitle })

    dispatch(action)
      .then(() => resetForm())
      .catch(() => setLoading(false))
  }, [url, title, editingId, dispatch, resetForm])

  const handleDeleteLink = useCallback((linkId) => {
    if (window.confirm(t('Are you sure you want to delete this link?'))) {
      dispatch(deleteUserProfileLink(linkId))
      if (editingId === linkId) resetForm()
    }
  }, [dispatch, t, editingId, resetForm])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = links.findIndex(link => String(link.id) === String(active.id))
    const newIndex = links.findIndex(link => String(link.id) === String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(links, oldIndex, newIndex)
    setDraftLinks(next)
    dispatch(reorderUserProfileLinks(next.map(link => link.id)))
      .catch(() => setDraftLinks(null))
  }, [links, dispatch])

  return (
    <div className='space-y-4'>
      <label className='text-sm font-medium text-foreground/50 mb-4 block'>{t('Profile Links')}</label>

      {links.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={links.map(link => String(link.id))} strategy={verticalListSortingStrategy}>
            <div className='space-y-2'>
              {links.map(link => (
                <SortableProfileLink key={link.id} link={link}>
                  {drag => editingId === link.id
                    ? (
                      <ProfileLinkForm
                        url={url}
                        title={title}
                        loading={loading}
                        isEditing
                        onUrlChange={setUrl}
                        onTitleChange={setTitle}
                        onSave={handleSaveLink}
                        onCancel={resetForm}
                      />
                      )
                    : (
                      <div className='relative group bg-background/50 hover:bg-background border border-foreground/10 hover:border-foreground/20 rounded-lg px-3 py-1 transition-all duration-300 flex items-center gap-3'>
                        <CollectionDragHandle attributes={drag.attributes} listeners={drag.listeners} />
                        <ProfileLinkIcon url={link.url} className='w-5 h-5 text-foreground/50 flex-shrink-0' />
                        <div className='flex-1 min-w-0'>
                          <div className='text-sm font-medium text-foreground truncate'>
                            {link.title || new URL(link.url).hostname.replace('www.', '')}
                          </div>
                          <a
                            href={link.url}
                            target='_blank'
                            rel='noreferrer'
                            className='text-xs text-foreground/50 truncate block hover:text-foreground/70'
                            onClick={e => e.stopPropagation()}
                          >
                            {link.url}
                          </a>
                        </div>
                        <a
                          href={link.url}
                          target='_blank'
                          rel='noreferrer'
                          className='p-2 hover:bg-foreground/10 rounded'
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className='w-4 h-4 text-foreground/50' />
                        </a>
                        <button
                          type='button'
                          aria-label={t('Edit')}
                          onClick={() => handleStartEdit(link)}
                          className='p-2 hover:bg-foreground/10 rounded text-foreground/70'
                        >
                          <Pencil className='w-4 h-4' />
                        </button>
                        <button
                          type='button'
                          aria-label={t('Delete')}
                          onClick={() => handleDeleteLink(link.id)}
                          className='p-2 hover:bg-destructive/10 rounded text-destructive'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </div>
                      )}
                </SortableProfileLink>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showForm
        ? (
          <ProfileLinkForm
            url={url}
            title={title}
            loading={loading}
            isEditing={false}
            onUrlChange={setUrl}
            onTitleChange={setTitle}
            onSave={handleSaveLink}
            onCancel={resetForm}
          />
          )
        : (
          <Button
            variant='outline'
            onClick={handleStartAdd}
            className='w-full'
          >
            <Plus className='w-4 h-4 mr-2' />
            {t('Add Profile Link')}
          </Button>
          )}
    </div>
  )
}

/** URL and optional title fields for adding or editing one profile link. */
function ProfileLinkForm ({ url, title, loading, isEditing, onUrlChange, onTitleChange, onSave, onCancel }) {
  const { t } = useTranslation()

  return (
    <div className='border border-foreground/10 rounded-lg p-4 space-y-3 bg-background/50'>
      <div>
        <label className='text-sm text-foreground/50 block mb-1'>{t('URL')}</label>
        <input
          type='url'
          value={url}
          onChange={e => onUrlChange(e.target.value)}
          placeholder='https://example.com'
          autoFocus
          className='w-full px-3 py-2 bg-midground border border-foreground/10 rounded-md text-foreground placeholder-foreground/40 focus:outline-none focus:border-foreground/30'
        />
      </div>
      <div>
        <label className='text-sm text-foreground/50 block mb-1'>{t('Title (optional)')}</label>
        <input
          type='text'
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder={t('Custom title for this link')}
          className='w-full px-3 py-2 bg-midground border border-foreground/10 rounded-md text-foreground placeholder-foreground/40 focus:outline-none focus:border-foreground/30'
        />
      </div>
      <div className='flex gap-2'>
        <Button
          variant='highVisibility'
          onClick={onSave}
          disabled={!url.trim() || loading}
          size='sm'
        >
          {isEditing ? t('Save') : t('Add Link')}
        </Button>
        <Button
          variant='outline'
          onClick={onCancel}
          size='sm'
        >
          {t('Cancel')}
        </Button>
      </div>
    </div>
  )
}
