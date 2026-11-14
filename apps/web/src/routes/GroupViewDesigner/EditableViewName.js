import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import { cn } from 'util/index'
import { updateDesignerSession, useDesignerSession } from './designerSession'

export const MAX_VIEW_NAME_LENGTH = 60

/**
 * The view's name in the designer's header. Clicking it turns it into a text
 * field; Enter or clicking away keeps the change and Escape drops it. A name
 * typed here is the steward's own, so the AI no longer suggests one.
 */
// The state of the view being designed, shown as a pill after its name
export function designStatus ({ isNew, session }) {
  if (isNew) return 'draft'
  return session.dirty || session.nameEdited ? 'unsaved' : 'published'
}

const STATUS_LABELS = { draft: 'Draft', unsaved: 'Unsaved changes', published: 'Published' }
const STATUS_HINTS = {
  draft: 'Not in the menu yet. Add it to the menu when you are happy with it.',
  unsaved: 'This view is in the menu. Your latest changes are not saved yet.',
  published: 'This view is in the menu as shown.'
}
const STATUS_STYLES = {
  draft: 'border-accent/50 bg-accent/10 text-foreground',
  unsaved: 'border-accent/50 bg-accent/10 text-foreground',
  published: 'border-selected/60 bg-selected/15 text-foreground'
}

function StatusPill ({ status }) {
  const { t } = useTranslation()
  return (
    <span
      title={t(STATUS_HINTS[status])}
      data-testid='designer-status'
      data-status={status}
      className={cn('shrink-0 rounded-full border-2 px-2 py-0.5 text-[11px] font-normal whitespace-nowrap', STATUS_STYLES[status])}
    >
      {t(STATUS_LABELS[status])}
    </span>
  )
}

export default function EditableViewName ({ sessionKey, placeholder, isNew = false }) {
  const { t } = useTranslation()
  const session = useDesignerSession(sessionKey)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const input = useRef(null)
  const name = session.name.trim()

  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  const start = () => {
    setValue(session.name)
    setEditing(true)
  }

  const commit = () => {
    const next = value.trim()
    // An emptied field goes back to the old name rather than leaving the view nameless
    if (next && next !== name) updateDesignerSession(sessionKey, { name: next, nameEdited: true })
    setEditing(false)
  }

  const onKeyDown = event => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setEditing(false)
    }
  }

  const status = <StatusPill status={designStatus({ isNew, session })} />

  if (editing) {
    return (
      <span className='inline-flex items-center gap-2'>
        <input
          ref={input}
          type='text'
          aria-label={t('Name in the menu')}
          value={value}
          onChange={event => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          maxLength={MAX_VIEW_NAME_LENGTH}
          data-testid='designer-view-name-input'
          className='min-w-[12rem] max-w-full rounded-md border-2 border-focus bg-input text-foreground px-2 py-0.5 text-lg font-bold outline-none'
        />
        {status}
      </span>
    )
  }

  return (
    <span className='inline-flex items-center gap-2'>
      <button
        type='button'
        onClick={start}
        title={t('Rename this view')}
        data-testid='designer-view-name'
        className='group inline-flex shrink-0 items-center gap-2 rounded-md border-2 border-transparent hover:border-foreground/20 px-1 -mx-1 text-left text-lg font-bold text-foreground'
      >
        <span className={cn('whitespace-nowrap truncate max-w-[50vw]', !name && 'text-foreground/50')}>{name || placeholder}</span>
        <Pencil className='w-3.5 h-3.5 shrink-0 text-foreground/40 group-hover:text-foreground/70' />
      </button>
      {status}
    </span>
  )
}
