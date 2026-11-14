import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TextareaAutosize from 'react-textarea-autosize'
import { ArrowLeft, FileText, ImagePlus, Lightbulb, Plus, SendHorizontal, Sparkles } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from 'components/ui/popover'
import { designedViewImageUrls } from '@hylo/shared'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { groupUrl } from '@hylo/navigation'
import useGroupViews from 'hooks/useGroupViews'
import designGroupViewTurn from 'store/actions/designGroupViewTurn'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import suggestGroupViews from 'store/actions/suggestGroupViews'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getHyloProEnabled from 'store/selectors/getHyloProEnabled'
import { cn } from 'util/index'
import { NEW_VIEW_ID } from './DesignerSaveButton'
import {
  addDesignDocument,
  addDesignImage,
  addDesignUsage,
  imagesFromUrls,
  isPdfUrl,
  MAX_DESIGN_DOCUMENTS,
  nameAfterTurn,
  designerSessionKey,
  updateDesignerSession,
  useDesignerSession
} from './designerSession'

// The designer's assistant speaks as Axl
export const ASSISTANT_NAME = 'Axl'

function AxlMessage ({ children }) {
  return (
    <div data-role='assistant' className='self-start max-w-[90%]'>
      <p className='m-0 mb-0.5 text-xs font-bold text-foreground/60'>{ASSISTANT_NAME}</p>
      <div className='rounded-lg px-3 py-2 text-sm whitespace-pre-line bg-card text-card-foreground border-2 border-foreground/10'>{children}</div>
    </div>
  )
}

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
      const design = existingView.settings?.design || null
      updateDesignerSession(key, { loaded: true, design, name: existingView.name || '', images: imagesFromUrls(designedViewImageUrls(design)) })
    }
  }, [groupId, isNew, existingView, session.loaded, key])

  useEffect(() => {
    listEnd.current?.scrollIntoView?.({ block: 'end' })
  }, [session.messages.length, session.sending])

  const backUrl = existingView ? groupUrl(groupSlug, `designed/${existingView.id}`) : groupUrl(groupSlug)
  const canChat = !!groupId && session.loaded && !withoutPro && !session.sending && !session.saving && !session.suggesting

  const send = async text => {
    const message = text.trim()
    if (!message || !canChat) return
    const messages = [...session.messages, { role: 'user', text: message }]
    updateDesignerSession(key, { messages, sending: true, error: null })
    setDraft('')
    try {
      const response = await dispatch(designGroupViewTurn(groupId, messages, session.design, session.images, session.documents))
      if (response?.error) throw response.payload || new Error(t('Something went wrong. Please try again.'))
      const result = response?.payload?.data?.designGroupViewTurn
      if (!result?.view) throw new Error(t('Something went wrong. Please try again.'))
      updateDesignerSession(key, current => ({
        messages: [...messages, { role: 'assistant', text: result.reply || t('I updated the page.') }],
        design: result.view,
        // The first design names the page, unless the steward already has
        name: nameAfterTurn(current, result.name),
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

  // Ideas for views that fit this group, from its purpose and what it already holds
  const suggest = async () => {
    if (!canChat) return
    updateDesignerSession(key, { suggesting: true, error: null })
    try {
      const response = await dispatch(suggestGroupViews(groupId))
      if (response?.error) throw response.payload || new Error(t('Something went wrong. Please try again.'))
      const result = response?.payload?.data?.suggestGroupViews
      if (!result?.suggestions?.length) throw new Error(t('Something went wrong. Please try again.'))
      updateDesignerSession(key, current => ({
        suggestions: { reply: result.reply || '', items: result.suggestions },
        suggesting: false,
        lastUsage: result.usage || null,
        usageTotal: result.usage ? addDesignUsage(current.usageTotal, result.usage) : current.usageTotal
      }))
    } catch (err) {
      updateDesignerSession(key, { suggesting: false, error: errorMessage(err) })
    }
  }

  const designSuggestion = suggestion => {
    if (!session.name.trim()) updateDesignerSession(key, { name: suggestion.name })
    send(suggestion.prompt)
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

  const [uploading, setUploading] = useState(false)
  const handleImageUploaded = uploaded => {
    if (!uploaded?.url) return
    updateDesignerSession(key, current => ({ images: addDesignImage(current.images, uploaded.url), error: null }))
  }
  const handleDocumentUploaded = uploaded => {
    if (!uploaded?.url) return
    if (!isPdfUrl(uploaded.url)) {
      updateDesignerSession(key, { error: t('Only PDF documents can be read. Add pictures as images.') })
      return
    }
    updateDesignerSession(key, current => ({ documents: addDesignDocument(current.documents, uploaded.url), error: null }))
  }
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const handleImageError = err => updateDesignerSession(key, { error: t('The file could not be added: {{message}}', { message: errorMessage(err) }) })

  // What this design has cost so far; the pill shows the total and its tooltip the detail
  const { lastUsage, usageTotal } = session
  const usageDetail = [
    t('AI cost of this design so far, estimated.'),
    t('Messages in this design: {{count}}, using {{tokens}} tokens', { count: usageTotal.count, tokens: usageTotal.tokens.toLocaleString() }),
    lastUsage ? t('Model {{model}}. Costs are estimates.', { model: lastUsage.model }) : null
  ].filter(Boolean).join(' ')

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
        <span
          className='ml-auto shrink-0 rounded-full border-2 border-foreground/15 bg-muted/50 px-2 py-0.5 text-[11px] tabular-nums text-foreground/70'
          title={usageDetail}
          aria-label={usageDetail}
          data-testid='designer-usage'
        >
          {usageTotal.costKnown ? `$${usageTotal.costUsd.toFixed(2)}` : t('cost unknown')}
        </span>
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

        {!withoutPro && (
          <AxlMessage>
            {session.design && session.messages.length === 0
              ? t('Hey there! What would you like to change on this page?')
              : t('Hey there! What do you want to build today? I can take a look at your group and make some suggestions if you like.')}
          </AxlMessage>
        )}

        {session.suggestions && (
          <div className='flex flex-col gap-2' data-testid='designer-suggestions'>
            {session.suggestions.reply && <AxlMessage>{session.suggestions.reply}</AxlMessage>}
            {session.suggestions.items.map(suggestion => (
              <div key={suggestion.name} className='rounded-lg border-2 border-foreground/20 bg-card text-card-foreground p-3' data-testid='designer-suggestion'>
                <p className='m-0 font-bold text-sm'>{suggestion.name}</p>
                <p className='m-0 text-xs text-foreground/70'>{suggestion.why}</p>
                <button
                  type='button'
                  disabled={!canChat}
                  onClick={() => designSuggestion(suggestion)}
                  className='mt-2 rounded-md bg-primary text-primary-foreground px-2 py-1 text-xs font-bold border-2 border-transparent disabled:opacity-50'
                >
                  {t('Design this')}
                </button>
              </div>
            ))}
          </div>
        )}

        {session.messages.map((message, index) => message.role === 'user'
          ? <div key={index} data-role='user' className='self-end rounded-lg px-3 py-2 text-sm whitespace-pre-line max-w-[90%] bg-selected/30'>{message.text}</div>
          : <AxlMessage key={index}>{message.text}</AxlMessage>)}
        {session.sending && (
          <p className='self-start text-xs text-foreground/60 m-0' role='status'>{t('Designing... this usually takes about 10 seconds.')}</p>
        )}
        {session.suggesting && (
          <p className='self-start text-xs text-foreground/60 m-0' role='status'>{t('Looking at your group...')}</p>
        )}
        {session.error && <p className='text-xs text-destructive m-0' role='alert'>{session.error}</p>}
        <div ref={listEnd} />
      </div>

      <div className='p-3 border-t-2 border-foreground/10 flex flex-col gap-2'>
        {!session.design && !session.suggestions && !withoutPro && (
          <button
            type='button'
            disabled={!canChat}
            onClick={suggest}
            className='inline-flex items-center justify-center gap-2 rounded-lg border-2 border-accent/50 hover:border-accent bg-accent/10 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50'
            data-testid='designer-suggest-views'
          >
            <Lightbulb className='w-4 h-4 text-accent' />
            {session.suggesting ? t('Looking at your group...') : t('Make some suggestions')}
          </button>
        )}
        <form onSubmit={handleSubmit} className='bg-input rounded-lg p-2 border-2 border-transparent focus-within:border-focus flex flex-col gap-2'>
          {(session.images.length > 0 || session.documents.length > 0) && (
            <div className='flex flex-wrap items-start gap-2' data-testid='designer-images'>
              {session.images.map((image, index) => (
                <figure key={image.url} className='m-0 w-14' data-testid='designer-image'>
                  <img src={image.url} alt={image.name} className='block w-14 h-10 m-0 object-cover rounded-md border-2 border-foreground/20' />
                  <figcaption className='text-[10px] text-foreground/60 text-center'>{t('Image {{number}}', { number: index + 1 })}</figcaption>
                </figure>
              ))}
              {session.documents.map(document => (
                <span
                  key={document.url}
                  title={document.name}
                  data-testid='designer-document'
                  className='inline-flex items-center gap-1 max-w-[10rem] rounded-md border-2 border-foreground/20 px-1.5 py-1 text-[11px] text-foreground/80'
                >
                  <FileText className='w-3.5 h-3.5 shrink-0' />
                  <span className='truncate'>{document.name}</span>
                </span>
              ))}
            </div>
          )}
          <div className='flex items-end gap-1'>
            <Popover open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type='button'
                  disabled={!canChat || uploading}
                  aria-label={t('Add an image or PDF')}
                  title={t('Add an image or PDF')}
                  data-testid='designer-add-attachment'
                  className='p-1.5 shrink-0 text-foreground/50 hover:text-foreground transition-colors disabled:opacity-50'
                >
                  <Plus className={cn('w-6 h-6', uploading && 'animate-pulse')} />
                </button>
              </PopoverTrigger>
              <PopoverContent side='top' align='start' arrow={false} className='w-60 p-1'>
                <UploadAttachmentButton
                  type='groupViewImage'
                  id={groupId}
                  attachmentType='image'
                  allowMultiple
                  disable={!canChat}
                  onSuccess={handleImageUploaded}
                  onError={handleImageError}
                  onLoadingChange={setUploading}
                  customRender={({ onClick }) => (
                    <button
                      type='button'
                      onClick={() => { setAttachMenuOpen(false); onClick() }}
                      data-testid='designer-add-image'
                      className='flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-foreground/10 text-sm text-foreground text-left'
                    >
                      <ImagePlus className='w-4 h-4' />{t('Add image')}
                    </button>
                  )}
                />
                <UploadAttachmentButton
                  type='groupViewFile'
                  id={groupId}
                  attachmentType='file'
                  disable={!canChat || session.documents.length >= MAX_DESIGN_DOCUMENTS}
                  onSuccess={handleDocumentUploaded}
                  onError={handleImageError}
                  onLoadingChange={setUploading}
                  customRender={({ onClick }) => (
                    <button
                      type='button'
                      onClick={() => { setAttachMenuOpen(false); onClick() }}
                      disabled={session.documents.length >= MAX_DESIGN_DOCUMENTS}
                      data-testid='designer-add-document'
                      className='flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-foreground/10 text-sm text-foreground text-left disabled:opacity-50'
                    >
                      <FileText className='w-4 h-4' />{t('Add PDF')}
                    </button>
                  )}
                />
                <p className='m-0 px-2 py-1.5 text-[11px] text-foreground/60'>
                  {t('Axl can read what you add, such as a flyer or a schedule, and turn it into a page. Files are sent to the AI to be read.')}
                </p>
              </PopoverContent>
            </Popover>
            <TextareaAutosize
              aria-label={t('Message')}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={session.design ? t('Ask for a change...') : t('Describe your page...')}
              minRows={1}
              maxRows={12}
              maxLength={2000}
              disabled={!canChat}
              data-testid='designer-message'
              className='flex-1 min-w-0 resize-none bg-transparent text-foreground text-sm leading-5 py-2 px-0 outline-none border-0'
            />
            <button
              type='submit'
              aria-label={t('Send')}
              disabled={!canChat || !draft.trim()}
              className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-selected text-foreground disabled:opacity-50'
            >
              <SendHorizontal size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
