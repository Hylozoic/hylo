import { cn } from 'util/index'
import { debounce, isEmpty, uniqueId } from 'lodash/fp'
import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'
import React, { useCallback, useMemo, useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { useSelector, useDispatch, useStore } from 'react-redux'
import { useLocation, useParams } from 'react-router-dom'
import useRouteParams from 'hooks/useRouteParams'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import { useTranslation } from 'react-i18next'
import { throttle } from 'lodash'
import isMobile from 'ismobilejs'
import { CaseSensitive, ImagePlus, Paperclip, Plus, Send } from 'lucide-react'
import { toast } from 'sonner'
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
  CHAT_ID_FOR_NEW,
  addAttachment,
  attachmentsFromUrls,
  clearAttachments,
  getAttachments,
  getUploadAttachmentPending,
  setAttachments
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
import useDraft, { hasDraftContent, hasPostDraftPayloadContent, keepAsDraftUnlessPresent } from 'hooks/useDraft'
import LinkPreview from 'components/PostEditor/LinkPreview'
import { buildPostDraftPayload, mergeDraftIntoPost } from 'components/PostEditor/postDraftUtils'
import isPlayableVideoUrl from 'util/isPlayableVideoUrl'
import isWebView from 'util/webView'
import { isPhoneDevice } from 'util/mobile'

/** Change-detection key for chat drafts: the text plus any attachment urls. */
const chatDraftKey = (details, imageUrls = [], fileUrls = []) =>
  JSON.stringify([details || '', imageUrls || [], fileUrls || []])

/**
 * True where Enter should send a chat message: a fine pointer (mouse or
 * trackpad, so almost certainly a real keyboard), not a phone and not the
 * mobile app's WebView. Everywhere else Enter adds a line, as on phones.
 */
export function enterSendsChat () {
  if (isWebView() || isPhoneDevice()) return false
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: fine)').matches
}

/**
 * Inline chat composer for ChatRoom — creates chat posts with draft persistence.
 */
function ChatEditorInner ({
  context = 'groups',
  autoFocus = true,
  setIsDirty = () => {},
  onSave,
  afterSave,
  onSaveFailed,
  onComposerFocus,
  onComposerBlur
}, ref) {
  const dispatch = useDispatch()
  const store = useStore()
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
  const lastSavedChatDraftKeyRef = useRef(chatDraftKey(''))
  const chatComposerHadContentRef = useRef(false)
  const isSubmittedRef = useRef(false)
  const isSubmittingRef = useRef(false)
  const mountedRef = useRef(false)

  const linkPreview = useSelector(state => getLinkPreview(state))
  const fetchLinkPreviewPending = useSelector(state => isPendingFor(FETCH_LINK_PREVIEW, state))
  // Local batch flag stays true until every selected file finishes uploading.
  // Redux UPLOAD_ATTACHMENT pending clears between each file, so it alone is
  // not enough to keep send disabled during multi-image picks.
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [uploadingAttachmentType, setUploadingAttachmentType] = useState(null)

  const uploadFileAttachmentPending = useSelector(state => getUploadAttachmentPending(state, { type: 'post', id: CHAT_ID_FOR_NEW, attachmentType: 'file' }))
  const uploadImageAttachmentPending = useSelector(state => getUploadAttachmentPending(state, { type: 'post', id: CHAT_ID_FOR_NEW, attachmentType: 'image' }))
  const imageAttachments = useSelector(
    state => getAttachments(state, { type: 'post', id: CHAT_ID_FOR_NEW, attachmentType: 'image' }),
    (a, b) => a.length === b.length && a.every((item, index) => item?.url === b[index]?.url)
  )
  const fileAttachments = useSelector(
    state => getAttachments(state, { type: 'post', id: CHAT_ID_FOR_NEW, attachmentType: 'file' }),
    (a, b) => a.length === b.length && a.every((item, index) => item?.url === b[index]?.url)
  )
  const imageUrls = useMemo(() => imageAttachments.map(a => a.url), [imageAttachments])
  const fileUrls = useMemo(() => fileAttachments.map(a => a.url), [fileAttachments])
  const loading = attachmentUploading || !!uploadImageAttachmentPending || !!uploadFileAttachmentPending

  const showImages = !isEmpty(imageAttachments) || uploadImageAttachmentPending || (attachmentUploading && uploadingAttachmentType === 'image')
  const showFiles = !isEmpty(fileAttachments) || uploadFileAttachmentPending || (attachmentUploading && uploadingAttachmentType === 'file')

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
  const [hasDescription, setHasDescription] = useState(false)
  // Formatting toolbar is hidden by default; the CaseSensitive button in the composer toggles it
  const [showToolbar, setShowToolbar] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [composerFocused, setComposerFocused] = useState(false)

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
    // Each room's draft brings its own attachments (none when it has no draft)
    dispatch(setAttachments('post', CHAT_ID_FOR_NEW, 'image', attachmentsFromUrls(post.imageUrls, 'image')))
    dispatch(setAttachments('post', CHAT_ID_FOR_NEW, 'file', attachmentsFromUrls(post.fileUrls, 'file')))
    lastSavedChatDraftKeyRef.current = chatDraftKey(details, post.imageUrls, post.fileUrls)
    draftLoadedRef.current = true
  }, [currentGroup, dispatch])

  useEffect(() => {
    draftLoadedRef.current = false
    lastSavedChatDraftKeyRef.current = chatDraftKey(initialPost.details)
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

    const draftKey = chatDraftKey(currentPost.details, imageUrls, fileUrls)
    const initialDraftKey = chatDraftKey(initialPost.details)
    const chatPayload = buildPostDraftPayload({ ...currentPost, imageUrls, fileUrls })

    if (!hasPostDraftPayloadContent(chatPayload)) {
      saveServerDraft(JSON.stringify(chatPayload))
      setIsDirty(false)
      lastSavedChatDraftKeyRef.current = draftKey
      if (chatComposerHadContentRef.current) {
        chatComposerHadContentRef.current = false
        clearDraft({ deleteOnServer: true }).catch(() => {})
      }
      return
    }

    if (draftKey === initialDraftKey) {
      setIsDirty(false)
      return
    }

    if (draftKey === lastSavedChatDraftKeyRef.current) {
      if (hasPostDraftPayloadContent(chatPayload)) {
        chatComposerHadContentRef.current = true
      }
      setIsDirty(true)
      return
    }

    chatComposerHadContentRef.current = true
    draftLoadedRef.current = true
    lastSavedChatDraftKeyRef.current = draftKey
    saveDraftJSON(chatPayload)
    setIsDirty(true)
  }, [currentPost, fileUrls, imageUrls, initialPost.details, saveDraftJSON, saveServerDraft, setIsDirty, clearDraft])

  // Keep keyboard focus when navigating between chat rooms
  useEffect(() => {
    if (!autoFocus) return
    const id = setTimeout(() => editorRef.current?.focus('end'), 150)
    return () => clearTimeout(id)
  }, [autoFocus, draftContextKey])

  useEffect(() => {
    return () => {
      dispatch(clearLinkPreview())
      dispatch(clearAttachments('post', CHAT_ID_FOR_NEW, 'image'))
      dispatch(clearAttachments('post', CHAT_ID_FOR_NEW, 'file'))
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
    dispatch(clearAttachments('post', CHAT_ID_FOR_NEW, 'image'))
    dispatch(clearAttachments('post', CHAT_ID_FOR_NEW, 'file'))
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

  const handleUploadError = useCallback(() => toast.error(t('Couldn\'t upload that file. Please try again.')), [t])

  const handleAttachmentLoadingChange = useCallback((next, attachmentType) => {
    setAttachmentUploading(next)
    setUploadingAttachmentType(next ? attachmentType : null)
    if (next) setAttachMenuOpen(false)
  }, [])

  const hasAttachments = !isEmpty(imageAttachments) || !isEmpty(fileAttachments)

  const invalidMessage = useMemo(() => {
    const errorMessages = []

    // Allow attachment-only chat posts (images and/or files) with no text.
    if (!hasDescription && !hasAttachments) {
      errorMessages.push(t('Chat must have text or an attachment'))
    }

    if (currentPost.groups?.length === 0) {
      errorMessages.push(t('At least one group required'))
    }

    return errorMessages.join('<br />')
  }, [currentPost.groups, hasAttachments, hasDescription, t])

  const isValid = !invalidMessage

  /** Puts a failed chat post back into the composer; the draft effect then re-saves it. */
  const restoreFailedPost = useCallback((postToSave) => {
    const details = postToSave.details || ''
    editorRef.current?.setContent(details)
    setEditorInitialContent(details)
    setHasDescription(hasDraftContent(details))
    setCurrentPost(prev => ({
      ...prev,
      details,
      linkPreview: postToSave.linkPreview || null,
      linkPreviewFeatured: !!postToSave.linkPreviewFeatured,
      skipLinkPreview: !!postToSave.skipLinkPreview
    }))
    dispatch(setAttachments('post', CHAT_ID_FOR_NEW, 'image', postToSave.imageAttachments || []))
    dispatch(setAttachments('post', CHAT_ID_FOR_NEW, 'file', postToSave.fileAttachments || []))
  }, [dispatch, setCurrentPost])

  /** True while this composer is still open on the room a message was sent from. */
  const isStillInRoom = useEventCallback(room => mountedRef.current && room.draftContextKey === draftContextKey)

  /**
   * Sends a chat post to the room it was written in, which the composer may
   * have left by the time the request settles.
   */
  const sendChatPost = useEventCallback(async (postToSave, room = { draftContextKey, groupId: currentGroup?.id, navigateTo: navigateToForDraft }) => {
    let savedPost
    try {
      savedPost = await dispatch(createPost(postToSave))
    } catch (error) {
      savedPost = { error }
    }

    if (savedPost && !savedPost.error) {
      await handleSendSucceeded(savedPost, room)
    } else {
      handleSendFailed(postToSave, room)
    }
  })

  const handleSendSucceeded = useEventCallback(async (savedPost, room) => {
    if (!isStillInRoom(room)) return
    await clearDraft()
    setIsDirty(false)
    if (afterSave) {
      afterSave(savedPost?.payload?.data?.createPost)
    }
  })

  /**
   * In the room it was sent from, the optimistic message is withdrawn and the
   * message goes back into the composer, unless something new is already
   * there. After leaving that room, it is kept as that room's draft instead.
   */
  const handleSendFailed = useEventCallback((postToSave, room) => {
    const stillInRoom = isStillInRoom(room)
    // Read from the store: the attachments in earlier closures are the ones that were just sent
    const composerAttachments = attachmentType =>
      getAttachments(store.getState(), { type: 'post', id: CHAT_ID_FOR_NEW, attachmentType })
    const composerIsEmpty = stillInRoom && !!editorRef.current &&
      !hasDraftContent(editorRef.current.getHTML()) &&
      isEmpty(composerAttachments('image')) && isEmpty(composerAttachments('file'))

    if (stillInRoom && onSaveFailed) onSaveFailed(postToSave.localId)
    if (composerIsEmpty) {
      restoreFailedPost(postToSave)
    } else if (!stillInRoom) {
      keepAsDraftUnlessPresent(dispatch, {
        type: 'post',
        groupId: room.groupId,
        postType: 'chat',
        navigateTo: room.navigateTo
      }, JSON.stringify(buildPostDraftPayload(postToSave)))
    }

    toast.error(t('Your message couldn\'t be sent'), {
      action: {
        label: t('Try Again'),
        onClick: () => retryFailedPost(postToSave, room, composerIsEmpty)
      }
    })
  })

  const retryFailedPost = useEventCallback((postToSave, room, restoredToComposer) => {
    const stillInRoom = isStillInRoom(room)
    if (restoredToComposer && stillInRoom) {
      doSave()
      return
    }
    if (stillInRoom && onSave) onSave(postToSave)
    sendChatPost(postToSave, room)
  })

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const save = useCallback(async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    let postToSave
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
      const rawDetails = editorRef.current.getHTML()
      // Don't persist empty TipTap shells ("<p></p>") — they render as a blank
      // line above attachment-only chat posts.
      const details = hasDraftContent(rawDetails) ? rawDetails : ''
      const imageUrls = imageAttachments && imageAttachments.map((attachment) => attachment.url)
      const fileUrls = fileAttachments && fileAttachments.map((attachment) => attachment.url)

      postToSave = {
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
    } finally {
      // The next message can be composed and sent while this request is in flight.
      isSubmittingRef.current = false
    }

    await sendChatPost(postToSave)
  }, [cancelPendingSave, currentPost, currentUser, fileAttachments, imageAttachments, onSave, reset, sendChatPost, stopTyping])

  const doSave = useEventCallback(() => {
    if (!isValid || loading) return
    save()
  }, [isValid, loading, save])

  // Decided once per mount: HyloEditor binds its key handlers when it is created
  const enterSends = useMemo(() => enterSendsChat(), [])
  // Enter never adds a line where it sends, even when there is nothing to send yet
  const handleEnter = useEventCallback(() => {
    doSave()
    return true
  })
  const handleComposerFocus = useEventCallback(() => {
    setComposerFocused(true)
    if (onComposerFocus) onComposerFocus()
  })
  const handleComposerBlur = useEventCallback(() => {
    setComposerFocused(false)
    if (onComposerBlur) onComposerBlur()
  })
  const sendHint = enterSends
    ? t('Enter to send, Shift-Enter for a new line')
    : isMobile.any
      ? undefined
      : t(navigator.platform.includes('Mac') ? 'Option-Enter to send' : 'Alt-Enter to send')

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
                id={CHAT_ID_FOR_NEW}
                attachmentType='image'
                onSuccess={(attachment) => {
                  dispatch(addAttachment('post', CHAT_ID_FOR_NEW, attachment))
                  setIsDirty(true)
                }}
                onError={handleUploadError}
                onLoadingChange={(next) => handleAttachmentLoadingChange(next, 'image')}
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
                id={CHAT_ID_FOR_NEW}
                attachmentType='file'
                onSuccess={(attachment) => {
                  dispatch(addAttachment('post', CHAT_ID_FOR_NEW, attachment))
                  setIsDirty(true)
                }}
                onError={handleUploadError}
                onLoadingChange={(next) => handleAttachmentLoadingChange(next, 'file')}
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
                  onEnter={enterSends ? handleEnter : undefined}
                  onAddTopic={handleAddTopic}
                  onAddLink={handleAddLinkPreview}
                  onFocus={handleComposerFocus}
                  onBlur={handleComposerBlur}
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
            title={!isValid ? invalidMessage.replace(/<br \/>/g, ', ') : sendHint}
            aria-keyshortcuts={enterSends ? 'Enter' : 'Alt+Enter'}
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
          id={CHAT_ID_FOR_NEW}
          attachmentType='image'
          showAddButton
          showLabel
          showLoading
          uploadAttachmentPending={loading && uploadingAttachmentType === 'image'}
          onLoadingChange={(next) => handleAttachmentLoadingChange(next, 'image')}
          onUploadError={handleUploadError}
        />
        <AttachmentManager
          type='post'
          id={CHAT_ID_FOR_NEW}
          attachmentType='file'
          showAddButton
          showLabel
          showLoading
          uploadAttachmentPending={loading && uploadingAttachmentType === 'file'}
          onLoadingChange={(next) => handleAttachmentLoadingChange(next, 'file')}
          onUploadError={handleUploadError}
        />
      </div>
      {enterSends && composerFocused && hasDescription && (
        <div className='absolute -bottom-4 right-2 text-[10px] leading-none text-foreground/40 pointer-events-none' data-testid='chat-send-hint'>
          {sendHint}
        </div>
      )}
    </div>
  )
}

export default forwardRef(ChatEditorInner)
