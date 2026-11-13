import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, SendHorizontal, Sparkles } from 'lucide-react'
import { groupUrl } from '@hylo/navigation'
import useGroupViews from 'hooks/useGroupViews'
import designGroupViewTurn from 'store/actions/designGroupViewTurn'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { createGroupView, updateGroupView } from 'store/actions/groupViews'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getHyloProEnabled from 'store/selectors/getHyloProEnabled'
import { formatUsd } from 'util/groupThemeEditor'
import { cn } from 'util/index'
import {
  addDesignUsage,
  designerSessionKey,
  resetDesignerSession,
  updateDesignerSession,
  useDesignerSession
} from './designerSession'

export const NEW_VIEW_ID = 'new'
const DESIGNED_VIEW_ICON = 'LayoutTemplate'

// Measured on real turns with the default model (Claude Opus 5.5): about $0.03 each
const TYPICAL_TURN_COST_USD = 0.03

const STARTERS = [
  'A welcome page for new members',
  "What's happening in the group this week",
  'How to get involved'
]

function errorMessage (error) {
  if (!error) return ''
  if (typeof error === 'string') return error
  return error.message || String(error)
}

/**
 * The chat side of "Design your own view". It takes the place of the group
 * menu while a steward designs a page: a back button, the conversation with
 * the AI, what it has cost, and saving the page to the group's menu. The page
 * itself is drawn in the main column by GroupViewDesigner.
 */
export default function DesignerChatColumn () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { groupSlug, viewId } = useParams()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const hyloProEnabled = useSelector(getHyloProEnabled)
  const groupViews = useGroupViews(group)
  const groupId = group?.id
  const isNew = viewId === NEW_VIEW_ID
  const key = designerSessionKey(groupId, viewId)
  const session = useDesignerSession(key)
  const [draft, setDraft] = useState('')
  const listEnd = useRef(null)

  const existingView = isNew ? null : groupViews.find(view => view.type === 'designed' && String(view.id) === String(viewId))
  const groupViewsLoaded = group?.groupViews != null
  // Only an explicit false blocks the chat; the server checks Hylo Pro either way
  const withoutPro = group?.hasPro === false

  useEffect(() => {
    if (groupId && !groupViewsLoaded) dispatch(fetchGroupViews(groupId))
  }, [dispatch, groupId, groupViewsLoaded])

  // Editing a saved view starts from its saved design and name
  useEffect(() => {
    if (!groupId || session.loaded) return
    if (isNew) {
      updateDesignerSession(key, { loaded: true })
    } else if (existingView) {
      updateDesignerSession(key, { loaded: true, design: existingView.settings?.design || null, name: existingView.name || '' })
    }
  }, [groupId, isNew, existingView, session.loaded, key])

  useEffect(() => {
    listEnd.current?.scrollIntoView?.({ block: 'end' })
  }, [session.messages.length, session.sending])

  const backUrl = existingView ? groupUrl(groupSlug, `designed/${existingView.id}`) : groupUrl(groupSlug)
  const canChat = !!groupId && session.loaded && !withoutPro && !session.sending && !session.saving

  const send = async text => {
    const message = text.trim()
    if (!message || !canChat) return
    const messages = [...session.messages, { role: 'user', text: message }]
    updateDesignerSession(key, { messages, sending: true, error: null })
    setDraft('')
    try {
      const response = await dispatch(designGroupViewTurn(groupId, messages, session.design))
      if (response?.error) throw response.payload || new Error(t('Something went wrong. Please try again.'))
      const result = response?.payload?.data?.designGroupViewTurn
      if (!result?.view) throw new Error(t('Something went wrong. Please try again.'))
      updateDesignerSession(key, current => ({
        messages: [...messages, { role: 'assistant', text: result.reply || t('I updated the page.') }],
        design: result.view,
        dirty: true,
        sending: false,
        lastUsage: result.usage || null,
        usageTotal: result.usage ? addDesignUsage(current.usageTotal, result.usage) : current.usageTotal
      }))
    } catch (err) {
      // Take the unanswered message back out so the conversation stays in turns, and give it back to edit
      updateDesignerSession(key, { messages: session.messages, sending: false, error: errorMessage(err) })
      setDraft(message)
    }
  }

  const handleSubmit = event => {
    event.preventDefault()
    send(draft)
  }

  const handleKeyDown = event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send(draft)
    }
  }

  const name = session.name.trim()
  const canSave = !!session.design && !!name && !session.saving && !session.sending && !withoutPro && (isNew || session.dirty || name !== (existingView?.name || ''))

  const handleSave = async () => {
    if (!canSave) return
    updateDesignerSession(key, { saving: true, error: null })
    try {
      const settings = { design: session.design }
      const response = await dispatch(isNew
        ? createGroupView({ groupId, type: 'designed', name, icon: DESIGNED_VIEW_ICON, settings, addToEnd: true })
        : updateGroupView({ id: existingView.id, groupId, name, settings }))
      if (response?.error) throw response.payload || new Error(t('Something went wrong. Please try again.'))
      const savedId = isNew ? response?.payload?.data?.createGroupView?.id : existingView.id
      if (!savedId) throw new Error(t('Something went wrong. Please try again.'))
      // The saved view is the source of truth from here on
      resetDesignerSession(key)
      if (isNew) resetDesignerSession(designerSessionKey(groupId, savedId))
      navigate(groupUrl(groupSlug, `designed/${savedId}`))
    } catch (err) {
      updateDesignerSession(key, { saving: false, error: errorMessage(err) })
    }
  }

  const cost = value => value === null || value === undefined
    ? t('cost unknown')
    : t('about {{cost}}', { cost: formatUsd(value) })
  const { lastUsage, usageTotal } = session

  return (
    <div
      className='flex flex-col h-full w-full sm:w-[380px] shrink-0 bg-background text-foreground border-r-2 border-foreground/10'
      data-testid='designer-chat-column'
    >
      <div className='flex items-center gap-2 p-3 border-b-2 border-foreground/10'>
        <Link
          to={backUrl}
          className='inline-flex items-center gap-1 rounded-md border-2 border-foreground/20 hover:border-foreground/50 px-2 py-1 text-sm text-foreground hover:text-foreground no-underline'
        >
          <ArrowLeft className='w-4 h-4' />{t('Back')}
        </Link>
        <h2 className='text-base font-bold m-0 flex items-center gap-1 min-w-0'>
          <Sparkles className='w-4 h-4 text-accent shrink-0' />
          <span className='truncate'>{isNew ? t('Design your own view') : t('Edit designed view')}</span>
        </h2>
      </div>

      <div className='flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3'>
        {withoutPro && (
          <div className='rounded-lg border-2 border-accent/40 bg-accent/10 p-3 text-sm' data-testid='designer-pro-notice'>
            <p className='m-0 font-bold'>{t('Designed views are part of Hylo Pro')}</p>
            <p className='m-0 text-foreground/70'>{t('To design a view or change one, the group needs Hylo Pro.')}</p>
            {hyloProEnabled && (
              <Link to={groupUrl(groupSlug, 'settings/billing')} className='inline-block mt-1 font-bold text-accent underline'>
                {t('See Hylo Pro')}
              </Link>
            )}
          </div>
        )}

        {session.messages.length === 0 && !withoutPro && (
          <div className='text-sm text-foreground/70'>
            <p className='m-0 mb-2'>
              {session.design
                ? t('Say what you would like to change on this page.')
                : t('Describe the page you want and AI will build it from posts, events, members, text and buttons. You can keep refining it before you save.')}
            </p>
            {!session.design && (
              <div className='flex flex-col gap-1'>
                {STARTERS.map(starter => (
                  <button
                    key={starter}
                    type='button'
                    disabled={!canChat}
                    onClick={() => send(t(starter))}
                    className='text-left rounded-md border-2 border-foreground/20 hover:border-foreground/50 px-2 py-1 text-sm disabled:opacity-50'
                  >
                    {t(starter)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {session.messages.map((message, index) => (
          <div
            key={index}
            data-role={message.role}
            className={cn(
              'rounded-lg px-3 py-2 text-sm whitespace-pre-line max-w-[90%]',
              message.role === 'user' ? 'self-end bg-selected/30' : 'self-start bg-card text-card-foreground border-2 border-foreground/10'
            )}
          >
            {message.text}
          </div>
        ))}
        {session.sending && (
          <p className='self-start text-xs text-foreground/60 m-0' role='status'>{t('Designing... this usually takes about 10 seconds.')}</p>
        )}
        {session.error && <p className='text-xs text-destructive m-0' role='alert'>{session.error}</p>}
        <div ref={listEnd} />
      </div>

      <div className='p-3 border-t-2 border-foreground/10 flex flex-col gap-2'>
        <form onSubmit={handleSubmit} className='flex items-end gap-2 bg-input rounded-lg p-2 border-2 border-transparent focus-within:border-focus'>
          <textarea
            aria-label={t('Message')}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={session.design ? t('Ask for a change...') : t('Describe your page...')}
            rows={2}
            maxLength={2000}
            disabled={!canChat}
            className='flex-1 min-w-0 resize-none bg-transparent text-foreground text-sm outline-none border-0 p-0'
          />
          <button
            type='submit'
            aria-label={t('Send')}
            disabled={!canChat || !draft.trim()}
            className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-selected text-foreground disabled:opacity-50'
          >
            <SendHorizontal size={18} />
          </button>
        </form>

        <div className='rounded-md border-2 border-foreground/10 bg-muted/50 px-2 py-1.5 text-xs text-foreground/70' data-testid='designer-usage'>
          <p className='m-0 font-bold text-foreground'>{t('AI usage and cost')}</p>
          {!lastUsage && (
            <p className='m-0'>{t('Each message costs about {{cost}}. The exact tokens and cost appear here as you go.', { cost: formatUsd(TYPICAL_TURN_COST_USD) })}</p>
          )}
          {lastUsage && (
            <>
              <p className='m-0'>
                {t('Last message: {{input}} input and {{output}} output tokens', {
                  input: lastUsage.inputTokens.toLocaleString(),
                  output: lastUsage.outputTokens.toLocaleString()
                })}, {cost(lastUsage.estimatedCostUsd)}
              </p>
              <p className='m-0'>
                {t('Messages in this design: {{count}}, using {{tokens}} tokens', {
                  count: usageTotal.count,
                  tokens: usageTotal.tokens.toLocaleString()
                })}, {cost(usageTotal.costKnown ? usageTotal.costUsd : null)}
              </p>
              <p className='m-0 text-foreground/50'>{t('Model {{model}}. Costs are estimates.', { model: lastUsage.model })}</p>
            </>
          )}
        </div>

        <div className='flex items-center gap-2'>
          <input
            type='text'
            aria-label={t('Name in the menu')}
            value={session.name}
            onChange={event => updateDesignerSession(key, { name: event.target.value })}
            placeholder={t('Name in the menu')}
            maxLength={60}
            className='flex-1 min-w-0 rounded-md border-2 border-foreground/20 bg-input text-foreground px-2 py-1 text-sm'
          />
          <button
            type='button'
            onClick={handleSave}
            disabled={!canSave}
            className='rounded-md bg-primary text-primary-foreground px-3 py-1 text-sm font-bold border-2 border-transparent disabled:opacity-50 shrink-0'
          >
            {session.saving ? t('Saving...') : (isNew ? t('Add to menu') : t('Save changes'))}
          </button>
        </div>
      </div>
    </div>
  )
}
