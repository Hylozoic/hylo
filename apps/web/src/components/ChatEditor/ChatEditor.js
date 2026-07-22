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
import AttachmentManager from 'components/AttachmentManager'
import HyloEditor from 'components/HyloEditor'
import Loading from 'components/Loading'
import isPendingFor from 'store/selectors/isPendingFor'
import getMe from 'store/selectors/getMe'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { CREATE_POST } from 'store/constants'
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
import ActionsBar from 'components/PostEditor/ActionsBar'
import LinkPreview from 'components/PostEditor/LinkPreview'
import { buildPostDraftPayload, mergeDraftIntoPost } from 'components/PostEditor/postDraftUtils'

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
  const postPending = useSelector(state => isPendingFor(CREATE_POST, state))
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

  useEffect(() => {
    const id = setTimeout(() => editorRef.current?.focus('end'), 150)
    return () => clearTimeout(id)
  }, [draftContextKey])

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => {
        editorRef.current && editorRef.current.focus()
      }, 500)
    }
    return () => {
      dispatch(clearLinkPreview())
      dispatch(clearAttachments('post', 'new', 'image'))
    }
  }, [])

  useEffect(() => {
    setCurrentPost(prev => (prev.linkPreview === linkPreview ? prev : { ...prev, linkPreview }))
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
      setTimeout(() => {
        editorRef.current && editorRef.current.focus()
      }, 500)
    }
  }, [autoFocus, clearDraft, dispatch, initialPost, setCurrentPost, setIsDirty])

  const handleDetailsChange = useCallback((html) => {
    const detailsText = editorRef.current?.getText?.() || ''
    setHasDescription(detailsText.length > 0)
    setCurrentPost(prev => ({ ...prev, details: html }))
  }, [setCurrentPost])

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
    setCurrentPost(prev => ({ ...prev, linkPreview: null, linkPreviewFeatured: false }))
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
      reset()

      const savedPost = await dispatch(createPost(postToSave))
      if (!savedPost.error) {
        await clearDraft()
        setIsDirty(false)
        if (afterSave) {
          afterSave(savedPost?.payload?.data?.createPost)
        }
      }
      isSubmittingRef.current = false
    } catch (error) {
      isSubmittingRef.current = false
      throw error
    }
  }, [afterSave, cancelPendingSave, clearDraft, currentPost, currentUser, dispatch, fileAttachments, imageAttachments, onSave, reset, setIsDirty])

  const doSave = useEventCallback(() => {
    if (!isValid || loading || postPending) return
    save()
  }, [isValid, loading, postPending, save])

  useImperativeHandle(ref, () => ({
    submit: () => doSave(),
    resetToInitial: () => reset()
  }))

  const buttonLabel = useCallback(() => {
    if (postPending) return t('Posting...')
    return t('Post')
  }, [postPending, t])

  const groupIds = currentGroup?.id ? [currentGroup.id] : undefined

  return (
    <div className={cn('flex flex-col rounded-lg bg-background p-3 shadow-2xl relative border-2 border-foreground/30 pb-1 pt-2 gap-2')}>
      <div
        className='absolute -top-[20px] left-0 right-0 h-[20px] bg-gradient-to-t from-black/10 to-transparent'
        style={{
          maskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 40px, rgba(0,0,0,1) calc(100% - 40px), rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 40px, rgba(0,0,0,1) calc(100% - 40px), rgba(0,0,0,0) 100%)'
        }}
      />
      <div className={cn(
        'ChatEditorContent w-full bg-input rounded p-1',
        'flex flex-col !items-start border-2 border-transparent shadow-md transition-all duration-200 overflow-x-hidden focus-within:border-2 focus-within:border-focus max-h-[300px]'
      )}
      >
        {currentPost.details === null || loading
          ? <div><Loading /></div>
          : <HyloEditor
              placeholder={t('Send a chat to {{groupName}}', { groupName: currentGroup?.name })}
              onUpdate={handleDetailsChange}
              onAltEnter={doSave}
              onAddTopic={handleAddTopic}
              onAddLink={handleAddLinkPreview}
              onFocus={onComposerFocus}
              onBlur={onComposerBlur}
              contentHTML={editorInitialContent}
              groupIds={groupIds}
              showMenu
              readOnly={loading}
              ref={editorRef}
            />}
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
      <ActionsBar
        id={currentPost.id}
        addAttachment={addAttachment}
        announcementSelected={false}
        canMakeAnnouncement={false}
        groupCount={currentPost.groups?.length || 0}
        groups={currentPost.groups}
        invalidMessage={invalidMessage}
        isEditing={false}
        loading={loading}
        submitting={postPending}
        myAdminGroups={[]}
        doSave={doSave}
        save={save}
        setAnnouncementSelected={() => {}}
        setIsDirty={setIsDirty}
        setShowLocation={() => {}}
        showAnnouncementModal={false}
        showFiles={showFiles}
        showImages={showImages}
        showLocation={false}
        submitButtonLabel={buttonLabel()}
        toggleAnnouncementModal={() => {}}
        type='chat'
        valid={isValid}
      />
    </div>
  )
}

export default forwardRef(ChatEditorInner)
