import React, { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Route, Routes, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutTemplate, MessageSquare, Monitor, Smartphone } from 'lucide-react'
import DesignedView from 'components/DesignedView'
import Loading from 'components/Loading'
import PostDialog from 'components/PostDialog'
import { groupUrl } from '@hylo/navigation'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useIsPhoneViewport from 'hooks/useIsPhoneViewport'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { cn } from 'util/index'
import { isPhoneDevice } from 'util/mobile'
import DesignerChatColumn from './DesignerChatColumn'
import DesignerSaveButton, { NEW_VIEW_ID } from './DesignerSaveButton'
import { designerSessionKey } from './designerSession'
import EditableViewName from './EditableViewName'
import useStoredDesignerSession from './useStoredDesignerSession'

// How wide the phone preview is: a common phone width in CSS pixels
export const PHONE_PREVIEW_WIDTH = 390

/**
 * Whether the designer uses its phone layout: on a phone, or in a window as narrow as one. The
 * group menu is a drawer there, so the chat can't sit beside the page.
 */
export function useDesignerPhoneLayout () {
  return useIsPhoneViewport() || isPhoneDevice()
}

/**
 * The chat column in the place of the group menu, beside the page. On phones the chat is a tab
 * of the designer's main column instead (see GroupViewDesigner), so nothing is shown here.
 */
export function DesignerNavColumn () {
  const phoneLayout = useDesignerPhoneLayout()
  return phoneLayout ? null : <DesignerChatColumn />
}

function SegmentButton ({ active, onClick, icon: Icon, children, testId }) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-bold border-2',
        active ? 'bg-selected/30 border-selected text-foreground' : 'border-transparent text-foreground/70 hover:text-foreground'
      )}
    >
      <Icon className='w-4 h-4' />{children}
    </button>
  )
}

/**
 * The canvas side of "Design your own view": the main column shows the page as
 * it stands in the design session, redrawn after every message in the chat
 * column (DesignerChatColumn, which takes the place of the group menu).
 *
 * On phones the chat and the page share the main column as two tabs, and the
 * page tab opens when Axl answers. On wider screens a toggle shows the page at
 * phone width, to check how it looks on a phone.
 */
export default function GroupViewDesigner () {
  const { t } = useTranslation()
  const { groupSlug, viewId } = useParams()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const sessionKey = designerSessionKey(group?.id, viewId)
  const { session } = useStoredDesignerSession(group, viewId)
  const { setHeaderDetails } = useViewHeader()
  const isNew = viewId === NEW_VIEW_ID
  const placeholder = isNew ? t('New designed view') : t('Designed view')
  const phoneLayout = useDesignerPhoneLayout()
  const [phoneTab, setPhoneTab] = useState('chat')
  const [phonePreview, setPhonePreview] = useState(false)

  // The header shows the view's name, which the steward can click to change
  useEffect(() => {
    setHeaderDetails({
      title: <EditableViewName sessionKey={sessionKey} placeholder={placeholder} isNew={isNew} />,
      icon: 'LayoutTemplate',
      search: false,
      headerActions: <DesignerSaveButton groupSlug={groupSlug} viewId={viewId} />
    })
  }, [setHeaderDetails, sessionKey, placeholder, isNew, groupSlug, viewId])

  // On a phone, show the page once Axl has answered with a new design (not when a stored one loads)
  const lastDesign = useRef(null)
  useEffect(() => {
    if (!session.loaded) return
    if (lastDesign.current && session.design && session.design !== lastDesign.current.design && !session.sending) setPhoneTab('page')
    lastDesign.current = { design: session.design }
  }, [session.loaded, session.design, session.sending])

  if (!group) return <Loading />

  const page = session.design
    ? (
      <DesignedView
        design={session.design}
        groupSlug={groupSlug}
        postUrlFor={postId => groupUrl(groupSlug, `design/${viewId}/post/${postId}`)}
      />
      )
    : (
      <div className='flex flex-col items-center justify-center text-center gap-2 p-10 text-foreground/60 min-h-[calc(100dvh-200px)]' data-testid='designer-empty'>
        <LayoutTemplate className='w-10 h-10' />
        <h2 className='m-0 text-2xl font-bold text-foreground'>{t('What do you want to build?')}</h2>
        <p className='m-0 text-sm max-w-sm'>{t('Describe what you need in the chat')}</p>
      </div>
      )

  if (phoneLayout) {
    return (
      <div className='w-full flex flex-col h-[calc(100dvh-64px)]' data-testid='designer-canvas'>
        <Routes>
          <Route path='post/:postId' element={<PostDialog />} />
        </Routes>
        <div className='flex justify-center gap-1 p-2 border-b-2 border-foreground/10 bg-background shrink-0' role='group' aria-label={t('Chat or page')}>
          <SegmentButton active={phoneTab === 'chat'} onClick={() => setPhoneTab('chat')} icon={MessageSquare} testId='designer-tab-chat'>{t('Chat')}</SegmentButton>
          <SegmentButton active={phoneTab === 'page'} onClick={() => setPhoneTab('page')} icon={LayoutTemplate} testId='designer-tab-page'>{t('Page')}</SegmentButton>
        </div>
        {phoneTab === 'chat'
          ? <div className='flex-1 min-h-0 flex'><DesignerChatColumn /></div>
          : <div className='flex-1 min-h-0 overflow-y-auto' data-testid='designer-page'>{page}</div>}
      </div>
    )
  }

  return (
    <div className='w-full' data-testid='designer-canvas'>
      <Routes>
        <Route path='post/:postId' element={<PostDialog />} />
      </Routes>
      <div className='flex justify-end gap-1 px-4 pt-3' role='group' aria-label={t('Preview')}>
        <SegmentButton active={!phonePreview} onClick={() => setPhonePreview(false)} icon={Monitor} testId='designer-preview-desktop'>{t('Desktop')}</SegmentButton>
        <SegmentButton active={phonePreview} onClick={() => setPhonePreview(true)} icon={Smartphone} testId='designer-preview-mobile'>{t('Preview mobile')}</SegmentButton>
      </div>
      {phonePreview
        ? (
          <div className='flex justify-center p-4' data-testid='designer-phone-preview'>
            <div
              className='w-full max-w-full rounded-[2rem] border-[10px] border-foreground/80 bg-midground overflow-hidden shadow-xl'
              style={{ width: PHONE_PREVIEW_WIDTH + 20 }}
            >
              <div className='h-[calc(100dvh-220px)] min-h-[480px] overflow-y-auto'>{page}</div>
            </div>
          </div>
          )
        : page}
    </div>
  )
}
