import { cn } from 'util/index'
import { debounce, isEmpty, uniqueId } from 'lodash/fp'
import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'
import React, { useCallback, useMemo, useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation, useParams } from 'react-router-dom'
import useRouteParams from 'hooks/useRouteParams'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import { useTranslation } from 'react-i18next'
import { throttle } from 'lodash'
import { CaseSensitive, ImagePlus, Paperclip, Plus, Send } from 'lucide-react'
import { sendIsTypingGroup } from 'client/websockets'
import AttachmentManager from 'components/AttachmentManager'
import HyloEditor from 'components/HyloEditor'
import Loading from 'components/Loading'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import isPendingFor from 'store/selectors/isPendingFor'
import getMe from 'store/selectors/getMe'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import createPost from 'store/actions/createPost'
import {
  addAttachment,
  clearAttachments,
  getAttachments,
  getUploadAttachmentPending
} from 'components/AttachmentManager/AttachmentManager.store'
import {
  FETCH_LINK_PREVIEW,
  pollingFetchLinkPreview,
  removeLinkPreview,
  clearLinkPreview,
  getLinkPreview
} from 'components/PostEditor/PostEditor.store'
import useEventCallback from 'hooks/useEventCallback'
import { MAX_POST_TOPICS } from 'util/constants'
import useDraft, { hasDraftContent, hasPostDraftPayloadContent } from 'hooks/useDraft'
import LinkPreview from 'components/PostEditor/LinkPreview'
import { buildPostDraftPayload, mergeDraftIntoPost } from 'components/PostEditor/postDraftUtils'
import isPlayableVideoUrl from 'util/isPlayableVideoUrl'

/**
 * Inline chat composer for ChatRoom — creates chat posts with draft persistence.
 */
function ChatEditorInner ({
  context = 'groups',
  autoFocus = true,
  setIsDirty = () => {},
  onSave,
  afterSave,
  onComposerFocus,
  onComposerBlur
}, ref) {
  const dispatch = useDispatch()
  const urlLocation = useLocation()
  const { pathname, search } = urlLocation
  const navigateToForDraft = `${pathname}${search || ''}`
  const routeParams = useParams()
  const parsedRouteParams = useRouteParams()
  const effectiveGroupSlug = useEffectiveGroupSlug()
  const groupSlug = effectiveGroupSlug || routeParams.groupSlug || parsedRouteParams.groupSlug
  const { t } = useTranslation()

  const currentUser = useSelector(getMe)
  const currentGroup = useSelector(state => getGroupForSlug(state, groupSlug))

  const { loadedData: serverLoadedData, isLoaded: serverDraftLoaded, saveDraft: saveServerDraft, cancelPendingSave, clearDraft } = useDraft({
    type: 'post',
    groupId: currentGroup?.id,
    postType: 'chat',
    navigateTo: navigateToForDraft,
    debounceMs: 1500,
    skip: !currentUser
  })

  const draftContextKey = useMemo(() => {
    return `chat:${currentGroup?.id || 'none'}`
  }, [currentGroup?.id])

  const loadDraftJSON = useCallback(() => {
    if (!serverLoadedData) return null
    try {
      return typeof serverLoadedData === 'string' ? JSON.parse(serverLoadedData) : serverLoadedData
    } catch {
      return null
    }
  }, [serverLoadedData])

  const saveDraftJSON = useCallback((value) => {
    if (!value || !hasPostDraftPayloadContent(value)) return
    saveServerDraft(JSON.stringify(value))
  }, [saveServerDraft])

  const draftLoadedRef = useRef(false)
  const lastSavedChatDetailsRef = useRef('')
  const chatComposerHadContentRef = useRef(false)
  const isSubmittedRef = useRef(false)
  const isSubmittingRef = useRef(false)

  const linkPreview = useSelector(state => getLinkPreview(state))
  const fetchLinkPreviewPending = useSelector(state => isPendingFor(FETCH_LINK_PREVIEW, state))
  const uploadAttachmentPending = useSelector(getUploadAttachmentPending)

  const uploadFileAttachmentPending = useSelector(state => getUploadAttachmentPending(state, { type: 'post', id: undefined, attachmentType: 'file' }))
  const uploadImageAttachmentPending = useSelector(state => getUploadAttachmentPending(state, { type: 'post', id: undefined, attachmentType: 'image' }))
  const imageAttachments = useSelector(
    state => getAttachments(state, { type: 'post', id: undefined, attachmentType: 'image' }),
    (a, b) => a.length === b.length && a.every((item, index) => item?.url === b[index]?.url)
  )
  const fileAttachments = useSelector(
    state => getAttachments(state, { type: 'post', id: undefined, attachmentType: 'file' }),
    (a, b) => a.length === b.length && a.every((item, index) => item?.url === b[index]?.url)
  )
  const loading = !!uploadAttachmentPending

  const showImages = !isEmpty(imageAttachments) || uploadImageAttachmentPending
  const showFiles = !isEmpty(fileAttachments) || uploadFileAttachmentPending

  const editorRef = useRef()

  const initialPost = useMemo(() => ({
    acceptContributions: false,
    details: '',
    groups: currentGroup ? [currentGroup] : [],
    isPublic: context === 'public',
    linkPreview: null,
    linkPreviewFeatured: false,
    timezone: DateTimeHelpers.dateTimeNow(getLocaleFromLocalStorage()).zoneName,
    title: '',
    topics: [],
    type: 'chat'
  }), [currentGroup?.id, context])

  const [currentPost, setCurrentPostState] = useState(initialPost)
  const [editorInitialContent, setEditorInitialContent] = useState('')
  const [invalidMessage, setInvalidMessage] = useState('')
  const [hasDescription, setHasDescription] = useState(false)
  // Formatting toolbar is hidden by default; the CaseSensitive button in the composer toggles it
  const [showToolbar, setShowToolbar] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)

  const setCurrentPost = useCallback((value) => {
    if (typeof value === 'function') {
      setCurrentPostState(prev => {
        const next = value(prev)
        return next === prev ? prev : next
      })
    } else {
      setCurrentPostState(prev => (value === prev ? prev : value))
    }
  }, [])

  const applyPostToEditor = useCallback((nextPost) => {
    let post = nextPost
    if (currentGroup?.id) {
      const hasCurrentGroup = post.groups?.some(g => g?.id === currentGroup.id)
      if (!hasCurrentGroup) {
        post = { ...post, groups: [currentGroup, ...(post.groups || [])] }
      }
    }
    setCurrentPostState(post)
    const details = post.details || ''
    setHasDescription(hasDraftContent(details))
    setEditorInitialContent(details)
    editorRef.current?.setContent(details)
    lastSavedChatDetailsRef.current = details
    draftLoadedRef.current = true
  }, [currentGroup])

  useEffect(() => {
    draftLoadedRef.current = false
    lastSavedChatDetailsRef.current = initialPost.details || ''
    chatComposerHadContentRef.current = false
  }, [draftContextKey])

  useEffect(() => {
    if (!serverDraftLoaded || draftLoadedRef.current) return
    const serverDraft = loadDraftJSON()
    const mergedPost = mergeDraftIntoPost(initialPost, serverDraft, [])
    applyPostToEditor(mergedPost)
  }, [applyPostToEditor, draftContextKey, serverDraftLoaded, initialPost, loadDraftJSON])

  useEffect(() => {
    if (!currentGroup?.id) return
    setCurrentPost(prev => {
      if (prev.groups?.length > 0) return prev
      return { ...prev, groups: [currentGroup] }
    })
  }, [currentGroup?.id, setCurrentPost])

  useEffect(() => {
    if (isSubmittedRef.current) return

    const details = currentPost.details || ''
    const initialDetails = initialPost.details || ''
    const chatPayload = buildPostDraftPayload(currentPost)

    if (!hasPostDraftPayloadContent(chatPayload)) {
      saveServerDraft(JSON.stringify(chatPayload))
      setIsDirty(false)
      lastSavedChatDetailsRef.current = details
      if (chatComposerHadContentRef.current) {
        chatComposerHadContentRef.current = false
        clearDraft({ deleteOnServer: true }).catch(() => {})
      }
      return
    }

    if (details === initialDetails) {
      setIsDirty(false)
      return
    }

    if (details === lastSavedChatDetailsRef.current) {
      if (hasPostDraftPayloadContent(chatPayload)) {
        chatComposerHadContentRef.current = true
      }
      setIsDirty(true)
      return
    }

    chatComposerHadContentRef.current = true
    draftLoadedRef.current = true
    lastSavedChatDetailsRef.current = details
    saveDraftJSON(chatPayload)
    setIsDirty(true)
  }, [currentPost, initialPost.details, saveDraftJSON, saveServerDraft, setIsDirty, clearDraft])

  // Keep keyboard focus when navigating between chat rooms
  useEffect(() => {
    if (!autoFocus) return
    const id = setTimeout(() => editorRef.current?.focus('end'), 150)
    return () => clearTimeout(id)
  }, [autoFocus, draftContextKey])

  useEffect(() => {
    return () => {
      dispatch(clearLinkPreview())
      dispatch(clearAttachments('post', 'new', 'image'))
    }
  }, [])

  useEffect(() => {
    setCurrentPost(prev => {
      if (prev.linkPreview === linkPreview) return prev
      if (linkPreview) {
        const isNewPreview = !prev.linkPreview || prev.linkPreview.id !== linkPreview.id
        return {
          ...prev,
          linkPreview,
          skipLinkPreview: false,
          linkPreviewFeatured: isNewPreview && isPlayableVideoUrl(linkPreview.url || linkPreview.ref?.url)
            ? true
            : prev.linkPreviewFeatured
        }
      }
      return { ...prev, linkPreview }
    })
  }, [linkPreview, setCurrentPost])

  const reset = useCallback(() => {
    editorRef.current?.setContent(initialPost.details)
    setHasDescription(initialPost.details?.length > 0)
    dispatch(clearLinkPreview())
    setCurrentPost(() => ({ ...initialPost, linkPreview: null, linkPreviewFeatured: false }))
    setEditorInitialContent(initialPost.details || '')
    dispatch(clearAttachments('post', 'new', 'image'))
    dispatch(clearAttachments('post', 'new', 'file'))
    clearDraft()
    chatComposerHadContentRef.current = false
    isSubmittedRef.current = false
    setIsDirty(false)
    if (autoFocus) {
      // Immediate end-focus. A delayed focus() defaults to the start and jumps
      // the caret after the next message has already begun.
      editorRef.current?.focus('end')
    }
  }, [autoFocus, clearDraft, dispatch, initialPost, setCurrentPost, setIsDirty])

  // Broadcast "I'm typing!" every 3 seconds while the user is typing, so people
  // in the room see the indicator even if they open the chat mid-composition.
  const startTyping = useMemo(() => throttle(() => {
    if (currentGroup?.id) sendIsTypingGroup(currentGroup.id, true)
  }, 3000), [currentGroup?.id])

  const stopTyping = useCallback(() => {
    startTyping.cancel()
    if (currentGroup?.id) sendIsTypingGroup(currentGroup.id, false)
  }, [startTyping, currentGroup?.id])

  useEffect(() => () => startTyping.cancel(), [startTyping])

  const handleDetailsChange = useCallback((html) => {
    const detailsText = editorRef.current?.getText?.() || ''
    setHasDescription(detailsText.length > 0)
    if (detailsText.length > 0) startTyping()
    setCurrentPost(prev => ({ ...prev, details: html }))
  }, [setCurrentPost, startTyping])

  const debouncedFetchLinkPreview = useRef(
    debounce(500, (url, force, currentLinkPreview) => {
      if (currentLinkPreview && !force) return
      pollingFetchLinkPreview(dispatch, url)
    })
  ).current

  const handleAddLinkPreview = useEventCallback((url, force) => {
    debouncedFetchLinkPreview(url, force, currentPost.linkPreview)
  }, [currentPost.linkPreview, debouncedFetchLinkPreview])

  const handleAddTopic = useEventCallback((topic) => {
    setCurrentPost(prev => {
      const topics = prev.topics || []
      if (topics.length >= MAX_POST_TOPICS) return prev
      return { ...prev, topics: [...topics, topic] }
    })
  }, [setCurrentPost])

  const handleFeatureLinkPreview = useCallback(featured => {
    setCurrentPost(prev => ({ ...prev, linkPreviewFeatured: featured }))
  }, [setCurrentPost])

  const handleRemoveLinkPreview = useCallback(() => {
    dispatch(removeLinkPreview())
    setCurrentPost(prev => ({ ...prev, linkPreview: null, linkPreviewFeatured: false, skipLinkPreview: true }))
  }, [dispatch, setCurrentPost])

  const isValid = useMemo(() => {
    const errorMessages = []

    if (!hasDescription) {
      errorMessages.push(t('Chat must have content'))
    }

    if (currentPost.groups?.length === 0) {
      errorMessages.push(t('At least one group required'))
    }

    if (errorMessages.length > 0) {
      setInvalidMessage(errorMessages.join('<br />'))
    }

    return errorMessages.length === 0
  }, [currentPost.groups, hasDescription, t])

  const save = useCallback(async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    try {
      const {
        groups,
        isPublic,
        linkPreview,
        linkPreviewFeatured,
        skipLinkPreview,
        timezone,
        title
      } = currentPost
      const details = editorRef.current.getHTML()
      const imageUrls = imageAttachments && imageAttachments.map((attachment) => attachment.url)
      const fileUrls = fileAttachments && fileAttachments.map((attachment) => attachment.url)

      const postToSave = {
        acceptContributions: false,
        commenters: [],
        createdAt: DateTimeHelpers.dateTimeNow(getLocaleFromLocalStorage()).toISO(),
        creator: currentUser,
        details,
        fileAttachments,
        fileUrls,
        groups,
        imageAttachments,
        imageUrls,
        isPublic,
        linkPreview,
        linkPreviewFeatured,
        skipLinkPreview,
        localId: uniqueId('post_'),
        pending: true,
        timezone,
        title,
        topicNames: [],
        type: 'chat'
      }

      if (onSave) onSave(postToSave)
      isSubmittedRef.current = true
      cancelPendingSave()
      stopTyping()
      reset()
      // The next message can be composed and sent while this request is in flight.
      isSubmittingRef.current = false

      const savedPost = await dispatch(createPost(postToSave))
      if (!savedPost.error) {
        await clearDraft()
        setIsDirty(false)
        if (afterSave) {
          afterSave(savedPost?.payload?.data?.createPost)
        }
      }
    } catch (error) {
      isSubmittingRef.current = false
      throw error
    }
  }, [afterSave, cancelPendingSave, clearDraft, currentPost, currentUser, dispatch, fileAttachments, imageAttachments, onSave, reset, setIsDirty, stopTyping])

  const doSave = useEventCallback(() => {
    if (!isValid || loading) return
    save()
  }, [isValid, loading, save])

  useImperativeHandle(ref, () => ({
    submit: () => doSave(),
    resetToInitial: () => reset()
  }))

  const groupIds = currentGroup?.id ? [currentGroup.id] : undefined
  const canSubmit = isValid && !loading

  return (
    <div className='flex flex-col relative gap-2'>
      <div className='ChatEditorContent w-full bg-foreground/5 border border-foreground/10 rounded-xl p-1.5 flex flex-col !items-start transition-all duration-200 overflow-x-hidden max-h-[300px] focus-within:border-foreground/20'>
        <div className='w-full flex items-center gap-1'>
          {/* Attachment menu — plain + icon before the input text */}
          <Popover open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type='button'
                className='p-1.5 shrink-0 text-foreground/50 hover:text-foreground transition-colors'
                aria-label={t('Add attachment')}
                data-testid='chat-attach-button'
              >
                <Plus className='w-6 h-6' />
              </button>
            </PopoverTrigger>
            <PopoverContent side='top' align='start' className='w-48 p-1'>
              <UploadAttachmentButton
                type='post'
                id={currentPost.id}
                attachmentType='image'
                onSuccess={(attachment) => {
                  dispatch(addAttachment('post', currentPost.id, attachment))
                  setIsDirty(true)
                  setAttachMenuOpen(false)
                }}
                allowMultiple
                disable={showImages}
                className='w-full'
              >
                <span className='flex items-center gap-2 w-full px-2 py-1.5 rounded-md cursor-pointer hover:bg-foreground/10 text-sm text-foreground' data-testid='add-image-icon'>
                  <ImagePlus className='w-4 h-4' />
                  {t('Upload image')}
                </span>
              </UploadAttachmentButton>
              <UploadAttachmentButton
                type='post'
                id={currentPost.id}
                attachmentType='file'
                onSuccess={(attachment) => {
                  dispatch(addAttachment('post', currentPost.id, attachment))
                  setIsDirty(true)
                  setAttachMenuOpen(false)
                }}
                allowMultiple
                disable={showFiles}
                className='w-full'
              >
                <span className='flex items-center gap-2 w-full px-2 py-1.5 rounded-md cursor-pointer hover:bg-foreground/10 text-sm text-foreground' data-testid='add-file-icon'>
                  <Paperclip className='w-4 h-4' />
                  {t('Attach file')}
                </span>
              </UploadAttachmentButton>
            </PopoverContent>
          </Popover>

          <div className='flex-1 min-w-0'>
            {currentPost.details === null || loading
              ? <div><Loading /></div>
              : <HyloEditor
                  placeholder={t('Chat with {{groupName}}', { groupName: currentGroup?.name })}
                  onUpdate={handleDetailsChange}
                  onAltEnter={doSave}
                  onAddTopic={handleAddTopic}
                  onAddLink={handleAddLinkPreview}
                  onFocus={onComposerFocus}
                  onBlur={onComposerBlur}
                  contentHTML={editorInitialContent}
                  groupIds={groupIds}
                  showMenu={showToolbar}
                  readOnly={loading}
                  ref={editorRef}
                />}
          </div>

          {/* Toolbar toggle + send, inside the input */}
          <button
            type='button'
            onClick={() => setShowToolbar(v => !v)}
            className={cn(
              'p-1.5 shrink-0 rounded-md transition-colors',
              showToolbar
                ? 'bg-foreground/15 text-foreground'
                : 'text-foreground/40 hover:text-foreground hover:bg-foreground/5'
            )}
            aria-label={t('Toggle formatting toolbar')}
            aria-pressed={showToolbar}
            data-testid='chat-toolbar-toggle'
          >
            <CaseSensitive className='w-6 h-6' />
          </button>
          {/* Ready-to-send fills with the selected colour. */}
          <button
            type='button'
            onClick={doSave}
            disabled={!canSubmit}
            title={!isValid ? invalidMessage.replace(/<br \/>/g, ', ') : undefined}
            className={cn(
              'p-1.5 shrink-0 rounded-lg border transition-colors',
              canSubmit
                ? 'bg-selected border-selected text-white hover:bg-selected/90'
                : 'border-foreground/20 text-muted-foreground cursor-not-allowed'
            )}
            aria-label={t('Post')}
            data-testid='chat-send-button'
          >
            <Send className='w-5 h-5' />
          </button>
        </div>
        {(currentPost.linkPreview || fetchLinkPreviewPending) && (
          <LinkPreview
            loading={fetchLinkPreviewPending}
            linkPreview={currentPost.linkPreview}
            featured={currentPost.linkPreviewFeatured}
            onFeatured={handleFeatureLinkPreview}
            onClose={handleRemoveLinkPreview}
          />
        )}
        <AttachmentManager
          type='post'
          id={currentPost.id}
          attachmentType='image'
          showAddButton
          showLabel
          showLoading
        />
        <AttachmentManager
          type='post'
          id={currentPost.id}
          attachmentType='file'
          showAddButton
          showLabel
          showLoading
        />
      </div>
    </div>
  )
}

export default forwardRef(ChatEditorInner)
