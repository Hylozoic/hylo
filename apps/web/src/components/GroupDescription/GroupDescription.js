import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { TextHelpers } from '@hylo/shared'
import ClickCatcher from 'components/ClickCatcher'
import HyloEditor from 'components/HyloEditor'
import HyloHTML from 'components/HyloHTML'
import Button from 'components/ui/button'
import { updateGroupSettings } from 'routes/GroupSettings/GroupSettings.store'

/** True when description HTML has visible text or embedded media. */
export function descriptionHasContent (html) {
  if (!html) return false
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length > 0) return true
  return /<(img|video|iframe|audio)\b/i.test(html)
}

/**
 * Group description editor and page-style display.
 * Admins edit with HyloEditor; everyone else sees the saved HTML.
 */
export default function GroupDescription ({ group, canEdit }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const editorRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const html = TextHelpers.richTextToHTML(group?.description)
  const hasContent = descriptionHasContent(html)
  const showEditor = canEdit && (editing || !hasContent)

  /** Persist editor HTML, or clear the description when the editor is empty. */
  const handleSave = async () => {
    const nextHtml = editorRef.current?.getHTML?.() ?? ''
    const description = descriptionHasContent(nextHtml) ? nextHtml : ''
    setSaving(true)
    try {
      await dispatch(updateGroupSettings(group.id, { description }))
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (!showEditor && !hasContent) return null

  if (showEditor) {
    return (
      <div>
        <HyloEditor
          key={`${group.id}-${editing ? 'edit' : 'compose'}`}
          contentHTML={html}
          className='min-h-[160px] overflow-y-auto p-2 [&_.ProseMirror]:min-h-[160px]'
          containerClassName='hyloEditor flex flex-col min-h-[220px] border border-foreground/20 rounded-lg bg-input'
          extendedMenu
          groupIds={[group.id]}
          placeholder={t('Add a group description')}
          ref={editorRef}
          showMenu
          type='welcomePage'
        />
        <div className='flex justify-end gap-2 mt-3'>
          {hasContent && (
            <Button variant='outline' onClick={() => setEditing(false)} disabled={saving}>
              {t('Cancel')}
            </Button>
          )}
          <Button variant='secondary' onClick={handleSave} disabled={saving}>
            {saving ? t('Saving...') : t('Save')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {canEdit && (
        <div className='flex justify-end mb-2'>
          <Button variant='outline' size='sm' onClick={() => setEditing(true)}>
            {t('Edit')}
          </Button>
        </div>
      )}
      <div className='hylo-page-html w-full'>
        <ClickCatcher groupSlug={group.slug}>
          <HyloHTML html={html} />
        </ClickCatcher>
      </div>
    </div>
  )
}
