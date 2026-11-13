import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutTemplate } from 'lucide-react'
import DesignedView from 'components/DesignedView'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { NEW_VIEW_ID } from './DesignerChatColumn'
import { designerSessionKey, useDesignerSession } from './designerSession'

/**
 * The canvas side of "Design your own view": the main column shows the page as
 * it stands in the design session, redrawn after every message in the chat
 * column (DesignerChatColumn, which takes the place of the group menu).
 */
export default function GroupViewDesigner () {
  const { t } = useTranslation()
  const { groupSlug, viewId } = useParams()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const session = useDesignerSession(designerSessionKey(group?.id, viewId))
  const { setHeaderDetails } = useViewHeader()
  const isNew = viewId === NEW_VIEW_ID
  const title = session.name.trim() || (isNew ? t('New designed view') : t('Designed view'))

  useEffect(() => {
    setHeaderDetails({ title, icon: 'LayoutTemplate', search: false })
  }, [setHeaderDetails, title])

  if (!group) return <Loading />

  return (
    <div className='w-full' data-testid='designer-canvas'>
      {session.design && session.dirty && (
        <p className='m-0 px-4 py-1 text-xs text-foreground/70 bg-accent/10 border-b-2 border-accent/30' role='status'>
          {isNew
            ? t('This is a draft. Name it and add it to the menu when you are happy with it.')
            : t('You have changes that are not saved yet.')}
        </p>
      )}
      {session.design
        ? <DesignedView design={session.design} groupSlug={groupSlug} />
        : (
          <div className='flex flex-col items-center justify-center text-center gap-2 p-10 text-foreground/60'>
            <LayoutTemplate className='w-10 h-10' />
            <p className='m-0 font-bold text-foreground'>{t('Your page will appear here')}</p>
            <p className='m-0 text-sm max-w-sm'>{t('Describe what you want in the chat on the left.')}</p>
          </div>
          )}
    </div>
  )
}
