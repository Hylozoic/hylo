import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Route, Routes, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TextareaAutosize from 'react-textarea-autosize'
import { Lock, SendHorizontal, ShieldCheck, Sparkles } from 'lucide-react'
import { groupUrl } from '@hylo/navigation'
import Loading from 'components/Loading'
import PostDialog from 'components/PostDialog'
import { GROUP_ASSISTANT } from 'config/featureFlags'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import createComment from 'store/actions/createComment'
import createPost from 'store/actions/createPost'
import { askGroupAssistant, fetchGroupAssistant, markGroupAssistantDraftPosted } from 'store/actions/groupAssistant'
import { hasFeature } from 'store/models/Me'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import AssistantMessage from './AssistantMessage'
import AxlAvatar from './AxlAvatar'
import { draftAsHtml, stewardNamesLine } from './util'

/**
 * The Group Assistant: a private thread between a group's stewards and Axl,
 * with a side panel for what needs a steward, settings changes Axl proposed,
 * and what it read this week.
 *
 * Everything here comes from the server only for stewards of a Hylo Pro group
 * that has turned the assistant on; anyone else gets the reason instead.
 */
export default function GroupAssistant () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const { groupSlug } = useParams()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const currentUser = useSelector(getMe)
  const groupId = group?.id
  const { setHeaderDetails } = useViewHeader()

  const [assistant, setAssistant] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [costUsd, setCostUsd] = useState(0)
  const scrollRef = useRef(null)

  useEffect(() => {
    setHeaderDetails({ title: t('Group Assistant'), icon: 'Sparkles', search: false })
  }, [setHeaderDetails, t])

  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    dispatch(fetchGroupAssistant(groupId)).then(response => {
      if (cancelled) return
      const result = response?.payload?.data?.groupAssistant
      if (response?.error || !result) {
        setLoadError(response?.payload?.message || t('Only stewards of this group can use the Group Assistant'))
        return
      }
      setAssistant(result)
      setMessages(result.messages || [])
    })
    return () => { cancelled = true }
  }, [dispatch, groupId, t])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages.length, sending])

  const send = useCallback(async text => {
    const message = text.trim()
    if (!message || sending) return
    setSending(true)
    setError(null)
    setDraft('')
    // Shown at once; replaced by the stored messages when the answer arrives
    const pending = { id: `pending-${Date.now()}`, authorType: 'steward', author: { id: currentUser?.id, name: currentUser?.name, avatarUrl: currentUser?.avatarUrl }, text: message, parts: [], createdAt: new Date().toISOString() }
    setMessages(current => [...current, pending])
    try {
      const response = await dispatch(askGroupAssistant(groupId, message))
      if (response?.error) throw response.payload || new Error(t('Something went wrong. Please try again.'))
      const result = response?.payload?.data?.askGroupAssistant
      if (!result?.messages) throw new Error(t('Something went wrong. Please try again.'))
      setMessages(current => [...current.filter(item => item.id !== pending.id), ...result.messages])
      if (result.usage?.estimatedCostUsd) setCostUsd(current => current + result.usage.estimatedCostUsd)
    } catch (err) {
      // The server keeps the steward's message even when Axl fails to answer, so it stays in the thread
      setError(err?.message || String(err))
    } finally {
      setSending(false)
    }
  }, [dispatch, groupId, sending, currentUser, t])

  // "Post it": the steward makes the post or reply themselves, with the ordinary mutations, then the draft is marked posted
  const postDraft = useCallback(async (message, partIndex, text) => {
    const part = message.parts[partIndex]
    const details = draftAsHtml(text)
    let posted
    if (part.replyToPostId) {
      const response = await dispatch(createComment({ post: { id: part.replyToPostId, groups: [{ id: groupId }] }, text: details }))
      if (response?.error) throw response.payload || new Error(t('Something went wrong. Please try again.'))
      posted = { commentId: response?.payload?.data?.createComment?.id }
    } else {
      const response = await dispatch(createPost({ type: 'discussion', title: part.title || text.trim().slice(0, 80), details, groups: [{ id: part.groupId }] }))
      if (response?.error) throw response.payload || new Error(t('Something went wrong. Please try again.'))
      posted = { postId: response?.payload?.data?.createPost?.id }
    }
    const marked = await dispatch(markGroupAssistantDraftPosted({ messageId: message.id, partIndex, ...posted }))
    const updated = marked?.payload?.data?.markGroupAssistantDraftPosted
    if (marked?.error || !updated) throw marked?.payload || new Error(t('It was posted, but could not be marked as posted here.'))
    setMessages(current => current.map(item => item.id === updated.id ? updated : item))
  }, [dispatch, groupId, t])

  if (!hasFeature(GROUP_ASSISTANT)) return null
  if (!group || (!assistant && !loadError)) return <Loading />

  const settingsUrl = groupUrl(groupSlug, 'settings/assistant')
  const notice = loadError ||
    (!assistant.hasPro && t('The Group Assistant is part of Hylo Pro.')) ||
    (!assistant.settings.enabled && t('The Group Assistant is turned off for this group.'))
  if (notice) {
    return (
      <div className='flex flex-col items-center justify-center text-center gap-3 p-10 min-h-[calc(100dvh-140px)]' data-testid='assistant-unavailable'>
        <AxlAvatar size={44} />
        <p className='m-0 text-base text-foreground/80 max-w-sm'>{notice}</p>
        {!loadError && <Link to={settingsUrl} className='text-sm font-bold text-selected'>{t('Open Group Assistant settings')}</Link>}
      </div>
    )
  }

  const readable = assistant.spaces.filter(space => assistant.settings.readableGroupIds.includes(space.id))
  const suggestions = [
    t('What needs a steward right now?'),
    t('Which posts have no reply yet?'),
    t('Help me with a conflict'),
    t('Draft a welcome for new members')
  ]
  const postUrl = postId => groupUrl(groupSlug, `assistant/post/${postId}`)
  const postsRead = messages.length // placeholder for the weekly receipt until nudges land

  return (
    <div className='flex w-full h-[calc(100dvh-56px)] min-h-0' data-testid='group-assistant'>
      <Routes>
        <Route path='post/:postId' element={<PostDialog />} />
      </Routes>
      <div className='flex-1 min-w-0 flex flex-col'>
        <div className='flex items-center gap-3 px-4 sm:px-6 py-3 border-b-2 border-foreground/10'>
          <AxlAvatar size={36} />
          <div className='flex-1 min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='m-0 text-lg font-bold text-foreground'>Axl</h1>
              <span className='text-sm font-semibold text-foreground/60'>{t('Group Assistant')}</span>
              <span className='inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-selected bg-selected/15 px-1.5 py-0.5 rounded'><Sparkles className='w-3 h-3' />{t('Pro')}</span>
              <span className='text-[10.5px] font-bold uppercase tracking-wide text-foreground/60 bg-foreground/10 px-1.5 py-0.5 rounded'>{t('Beta')}</span>
            </div>
            <p className='m-0 mt-0.5 flex items-center gap-1.5 text-xs text-foreground/60' data-testid='assistant-stewards'>
              <Lock className='w-3 h-3 shrink-0' />
              <span className='truncate'>{stewardNamesLine(assistant.stewards, currentUser?.id, t)}</span>
            </p>
          </div>
          <span className='shrink-0 text-[11px] text-foreground/50 bg-foreground/10 rounded-full px-2 py-0.5' data-testid='assistant-usage' title={t('Estimated AI cost of this visit')}>
            ${costUsd.toFixed(2)}
          </span>
        </div>

        <div ref={scrollRef} className='flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 pt-3 pb-2'>
          <div className='flex gap-2.5 items-start rounded-lg border-2 border-foreground/15 bg-card text-xs leading-relaxed text-foreground/70 px-3 py-2.5 my-1.5 max-w-[720px]'>
            <ShieldCheck className='w-4 h-4 shrink-0 text-accent mt-px' />
            <span>
              {t('Axl reads only the spaces your stewards chose and helps you tend the group. It never changes a setting or posts for you: it drafts, and a steward decides.')}
              {' '}
              {readable.length > 0
                ? t('It can read: {{spaces}}.', { spaces: readable.map(space => space.name).join(', ') })
                : t('It cannot read any space yet.')}
              {' '}
              <Link to={settingsUrl} className='font-bold text-selected'>{t('Change')}</Link>
            </span>
          </div>
          {messages.length === 0 && (
            <div className='flex gap-3 py-2.5' data-testid='assistant-greeting'>
              <AxlAvatar size={34} />
              <p className='m-0 text-sm leading-relaxed text-foreground/85 max-w-[680px]'>
                {t('Hi, I’m Axl. Ask me what needs a steward, talk a tense thread through with me, or have me draft a reply for you to post.')}
              </p>
            </div>
          )}
          {messages.map(message => (
            <AssistantMessage key={message.id} message={message} currentUserId={currentUser?.id} postUrl={postUrl} onPostDraft={postDraft} />
          ))}
          {sending && (
            <div className='flex gap-3 items-center py-2.5' role='status' aria-label={t('Axl is thinking')} data-testid='assistant-typing'>
              <AxlAvatar size={34} />
              <span className='flex gap-1 px-3 py-2.5 rounded-xl bg-card'>
                {[0, 1, 2].map(index => <span key={index} className='w-1.5 h-1.5 rounded-full bg-accent animate-pulse' style={{ animationDelay: `${index * 150}ms` }} />)}
              </span>
            </div>
          )}
          {error && <p className='m-0 py-2 text-sm text-accent' role='alert' data-testid='assistant-error'>{error}</p>}
        </div>

        <div className='px-4 sm:px-7 pt-2 pb-4'>
          <div className='flex flex-wrap gap-1.5 mb-2'>
            {suggestions.map(suggestion => (
              <button
                key={suggestion}
                type='button'
                onClick={() => send(suggestion)}
                disabled={sending}
                className='h-7 px-3 rounded-full border-2 border-accent/30 bg-card text-foreground/85 text-xs font-semibold hover:border-accent/60 disabled:opacity-50'
              >
                {suggestion}
              </button>
            ))}
          </div>
          <form
            onSubmit={event => { event.preventDefault(); send(draft) }}
            className='flex items-end gap-2 p-1.5 rounded-xl border-2 border-foreground/20 bg-card max-w-[900px] focus-within:border-focus'
          >
            <TextareaAutosize
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  send(draft)
                }
              }}
              minRows={1}
              maxRows={10}
              maxLength={4000}
              aria-label={t('Message')}
              placeholder={t('Ask Axl for advice, or for a draft')}
              className='flex-1 min-w-0 bg-transparent border-0 outline-none resize-none text-sm text-foreground px-2 py-2'
            />
            <button
              type='submit'
              disabled={sending || !draft.trim()}
              aria-label={t('Send')}
              className='grid place-items-center h-9 w-9 shrink-0 rounded-lg bg-accent text-white disabled:opacity-50'
            >
              <SendHorizontal className='w-4 h-4' />
            </button>
          </form>
        </div>
      </div>

      <aside className='hidden lg:block w-[300px] shrink-0 border-l-2 border-foreground/10 overflow-y-auto px-3.5 py-4' data-testid='assistant-side-panel'>
        <h2 className='m-0 mb-2 text-sm font-extrabold text-foreground'>{t('Needs a steward')}</h2>
        <p className='m-0 mb-5 text-xs leading-relaxed text-foreground/60'>{t('Nothing waiting on a steward right now.')}</p>
        <h2 className='m-0 mb-2 text-sm font-extrabold text-foreground'>{t('Settings changes')}</h2>
        <p className='m-0 mb-5 text-xs leading-relaxed text-foreground/60'>{t('When a steward approves one of Axl’s suggestions, it shows up here with an undo.')}</p>
        <h2 className='m-0 mb-2 text-sm font-extrabold text-foreground'>{t('This week')}</h2>
        <p className='m-0 text-xs leading-relaxed text-foreground/60' data-postsread={postsRead}>
          {t('What Axl read and what came of it will be counted here.')}
        </p>
      </aside>
    </div>
  )
}
