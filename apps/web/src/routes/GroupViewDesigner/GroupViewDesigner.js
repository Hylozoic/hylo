import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Route, Routes, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutTemplate } from 'lucide-react'
import DesignedView from 'components/DesignedView'
import Loading from 'components/Loading'
import PostDialog from 'components/PostDialog'
import { groupUrl } from '@hylo/navigation'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import DesignerSaveButton, { NEW_VIEW_ID } from './DesignerSaveButton'
import { designerSessionKey, useDesignerSession } from './designerSession'
import EditableViewName from './EditableViewName'

/**
 * The canvas side of "Design your own view": the main column shows the page as
 * it stands in the design session, redrawn after every message in the chat
 * column (DesignerChatColumn, which takes the place of the group menu).
 */
export default function GroupViewDesigner () {
  const { t } = useTranslation()
  const { groupSlug, viewId } = useParams()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const sessionKey = designerSessionKey(group?.id, viewId)
  const session = useDesignerSession(sessionKey)
  const { setHeaderDetails } = useViewHeader()
  const isNew = viewId === NEW_VIEW_ID
  const placeholder = isNew ? t('New designed view') : t('Designed view')

  // The header shows the view's name, which the steward can click to change
  useEffect(() => {
    setHeaderDetails({
      title: <EditableViewName sessionKey={sessionKey} placeholder={placeholder} isNew={isNew} />,
      icon: 'LayoutTemplate',
      search: false,
      headerActions: <DesignerSaveButton groupSlug={groupSlug} viewId={viewId} />
    })
  }, [setHeaderDetails, sessionKey, placeholder, isNew, groupSlug, viewId])

  if (!group) return <Loading />

  return (
    <div className='w-full' data-testid='designer-canvas'>
      <Routes>
        <Route path='post/:postId' element={<PostDialog />} />
      </Routes>
      {session.design
        ? (
          <DesignedView
            design={session.design}
            groupSlug={groupSlug}
            postUrlFor={postId => groupUrl(groupSlug, `design/${viewId}/post/${postId}`)}
          />
          )
        : (
          <div className='flex flex-col items-center justify-center text-center gap-2 p-10 text-foreground/60 min-h-[calc(100dvh-140px)]' data-testid='designer-empty'>
            <LayoutTemplate className='w-10 h-10' />
            <h2 className='m-0 text-2xl font-bold text-foreground'>{t('What do you want to build?')}</h2>
            <p className='m-0 text-sm max-w-sm'>{t('Describe what you need in the chat')}</p>
          </div>
          )}
    </div>
  )
}
