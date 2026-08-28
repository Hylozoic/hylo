/* global DOMParser */
import { cn } from 'util/index'
import useTour from 'tours/useTour'
import { POST_EDITOR_TOUR_ID, postEditorTourSteps } from 'tours/postEditorTour'
import { debounce, get, isEqual, isEmpty, uniqBy, uniqueId } from 'lodash/fp'
import { TriangleAlert, X } from 'lucide-react'
import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'
import React, { useCallback, useMemo, useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import useRouteParams from 'hooks/useRouteParams'
import useAllowedPostTypesForView from 'hooks/useAllowedPostTypesForView'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import { useTranslation } from 'react-i18next'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { createSelector } from 'reselect'
import { getHourCycle } from 'components/Calendar/calendar-util'
import AttachmentManager from 'components/AttachmentManager'
import Icon from 'components/Icon'
import LocationInput from 'components/LocationInput'
import HyloEditor from 'components/HyloEditor'
import Loading from 'components/Loading'
import PostTypeSelect from 'components/PostTypeSelect'
import Switch from 'components/Switch'
import ToField from 'components/ToField'
import MemberSelector from 'components/MemberSelector'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'components/ui/dialog'
import LinkPreview from './LinkPreview'
import { DateTimePicker } from 'components/ui/datetimepicker'
import TimezoneSelect from 'components/TimezoneSelect/TimezoneSelect'
import PublicToggle from 'components/PublicToggle'
import AnonymousVoteToggle from './AnonymousVoteToggle/AnonymousVoteToggle'
import SliderInput from 'components/SliderInput/SliderInput'
import { PROJECT_CONTRIBUTIONS } from 'config/featureFlags'
import useEventCallback from 'hooks/useEventCallback'
import fetchAllMyGroupsSpaces from 'store/actions/fetchAllMyGroupsSpaces'
import fetchForGroup from 'store/actions/fetchForGroup'
import {
  PROPOSAL_ADVICE,
  PROPOSAL_CONSENSUS,
  PROPOSAL_CONSENT,
  PROPOSAL_GRADIENT,
  PROPOSAL_MULTIPLE_CHOICE,
  PROPOSAL_POLL_SINGLE,
  PROPOSAL_TEMPLATES,
  PROPOSAL_YESNO,
  POST_COMPLETION_ACTIONS,
  POST_TYPES,
  POST_TYPES_SHOW_LOCATION_BY_DEFAULT,
  VOTING_METHOD_MULTI_UNRESTRICTED,
  VOTING_METHOD_SINGLE
} from 'store/models/Post'
import { GROUP_TYPES } from 'store/models/Group'
import isPendingFor from 'store/selectors/isPendingFor'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getPost from 'store/selectors/getPost'
import presentPost from 'store/presenters/presentPost'
import getFundingRound from 'store/selectors/getFundingRound'
import getTopicForCurrentRoute from 'store/selectors/getTopicForCurrentRoute'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { fetchLocation, ensureLocationIdIfCoordinate } from 'components/LocationInput/LocationInput.store'
import {
  CREATE_POST,
  CREATE_PROJECT,
  FETCH_POST,
  RESP_ADMINISTRATION,
  UPDATE_POST
} from 'store/constants'
import createPost from 'store/actions/createPost'
import updatePost from 'store/actions/updatePost'
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
} from './PostEditor.store'
import { MAX_POST_TOPICS } from 'util/constants'
import generateTempID from 'util/generateTempId'
import { setQuerystringParam } from '@hylo/navigation'
import { sanitizeURL } from 'util/url'
import ActionsBar from './ActionsBar'
import HyloHTML from 'components/HyloHTML'
import useDraft, { hasDraftContent, hasPostDraftPayloadContent } from 'hooks/useDraft'
import { buildPostDraftPayload, mergeDraftIntoPost } from './postDraftUtils'

/** First post type as shown in PostTypeSelect (POST_TYPES order), among allowed types. */
function firstDropdownPostType (allowedPostTypes) {
  const dropdownOrder = Object.keys(POST_TYPES).filter(type => type !== 'action' && type !== 'chat')
  if (allowedPostTypes == null) return 'discussion'
  return dropdownOrder.find(type => allowedPostTypes.includes(type)) || 'discussion'
}

/** Returns true when a group/space accepts the given post type (null acceptedPostTypes = all). */
function groupAcceptsPostType (group, postType) {
  if (!group || !postType) return false
  const types = group.acceptedPostTypes
  if (types == null) return true
  if (!Array.isArray(types) || types.length === 0) return false
  return types.includes(postType)
}

/** Returns true when the group is a space (child of a top-level group). */
function isSpaceGroup (group) {
  return !!group && (group.type === GROUP_TYPES.space || !!group.parentId)
}

/** Compares group ids as strings so GraphQL/ORM number vs string ids still match. */
function sameGroupId (a, b) {
  return a != null && b != null && String(a) === String(b)
}

const emojiOptions = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '✅✅', '👍', '👎', '⁉️', '‼️', '❓', '❗', '🚫', '➡️', '🛑', '✅', '🛑🛑', '🌈', '🔴', '🔵', '🟤', '🟣', '🟢', '🟡', '🟠', '⚫', '⚪', '🤷🤷', '📆', '🤔', '❤️', '👏', '🎉', '🔥', '🤣', '😢', '😡', '🤷', '💃🕺', '⛔', '🙏', '👀', '🙌', '💯', '🔗', '🚀', '💃', '🕺', '🫶💯']
const MAX_TITLE_LENGTH = 80

const getMyAdminGroups = createSelector(
  [
    state => state,
    state => getMe(state),
    (state, groupOptions) => groupOptions
  ],
  (state, currentUser, groupOptions) => {
    if (!currentUser) return []
    return groupOptions.filter(g => hasResponsibilityForGroup(state, { person: currentUser, groupId: g.id, responsibility: RESP_ADMINISTRATION }))
  }
)

/**
 * PostEditor component for creating and editing various post types (discussions, events, projects, proposals, etc.)
 * @param {Object} props - Component props
 * @param {string} props.context - the overall route context (e.g., 'my', 'groups')
 * @param {Object} props.post - Post data when editing an existing post
 * @param {boolean} props.editing - Whether we're editing an existing post
 * @param {Function} props.setIsDirty - Callback to notify parent when content changes
 * @param {Function} props.onCancel - Callback when cancel is clicked
 * @param {Function} props.onSave - Callback when save is clicked
 * @param {Function} props.afterSave - Callback after post is successfully saved
 * @param {string} props.selectedLocation - Pre-selected location if any
 */

function PostEditorInner ({
  context,
  customTopicName, // When we can't determine topic from the URL (e.g. funding rounds)
  markAsReadTopicName = null,
  autoFocus = true,
  post: propsPost,
  editing = false,
  setIsDirty = () => {},
  onCancel,
  onSave,
  afterSave,
  selectedLocation,
  draftId
}, ref) {
  const dispatch = useDispatch()
  const urlLocation = useLocation()
  const { pathname, search } = urlLocation
  const navigateToForDraft = `${pathname}${search || ''}`
  const routeParams = useParams()
  const parsedRouteParams = useRouteParams()
  // When inside a space, this resolves to the space group's slug so chats/posts go to the space
  const effectiveGroupSlug = useEffectiveGroupSlug()
  const groupSlug = effectiveGroupSlug || routeParams.groupSlug || parsedRouteParams.groupSlug
  const navigate = useNavigate()
  const hourCycle = getHourCycle()
  const { t } = useTranslation()

  const currentUser = useSelector(getMe)
  const myMemberships = useSelector(getMyMemberships)

  // First-time-in-the-editor tour, offered via a floating invitation
  const editorTourSteps = useMemo(() => postEditorTourSteps(t), [t])
  const { invitation: editorTourInvitation } = useTour({
    id: POST_EDITOR_TOUR_ID,
    steps: editorTourSteps,
    autoStart: true,
    inviteMessage: t('Want a quick tour of the post editor?')
  })
  const currentGroup = useSelector(state => getGroupForSlug(state, groupSlug))
  // Track / funding-round spaces carry their config on the group itself.
  const currentTrack = currentGroup?.track || null
  const currentFundingRound = useSelector(state => {
    const nested = currentGroup?.fundingRound
    if (nested?.id) return getFundingRound(state, nested.id) || nested
    if (routeParams.fundingRoundId) return getFundingRound(state, routeParams.fundingRoundId)
    return null
  })
  // Restrict create-modal type options to the current view's post types (e.g. request/offer on requests-and-offers)
  // intersected with the current group's acceptedPostTypes when set.
  const allowedPostTypesForView = useAllowedPostTypesForView()
  const allowedPostTypes = useMemo(() => {
    if (editing) return null

    const fromView = allowedPostTypesForView
    const fromGroup = currentGroup?.acceptedPostTypes

    // null/undefined acceptedPostTypes = group accepts all types
    if (fromGroup == null) return fromView
    if (!Array.isArray(fromGroup)) return fromView
    // Typed views (track-actions, funding-round-submissions) keep their post type even when
    // the space has empty acceptedPostTypes (track/FR spaces do not use stream post types).
    if (fromView != null) {
      if (fromGroup.length === 0) return fromView
      return fromView.filter(type => fromGroup.includes(type))
    }
    return fromGroup
  }, [editing, allowedPostTypesForView, currentGroup?.acceptedPostTypes])

  useEffect(() => {
    if (groupSlug && !currentGroup) dispatch(fetchForGroup(groupSlug))
  }, [dispatch, groupSlug, currentGroup])

  const editingPostId = routeParams.postId
  const fromPostId = getQuerystringParam('fromPostId', urlLocation)
  const viewId = getQuerystringParam('viewId', urlLocation)

  const postType = getQuerystringParam('newPostType', urlLocation)
  const eventDateParam = getQuerystringParam('eventDate', urlLocation)
  // Prefer explicit newPostType (if still allowed), else top dropdown option (POST_TYPES order)
  const createPostType = (() => {
    const fallback = firstDropdownPostType(allowedPostTypes)
    if (!postType) return fallback
    if (allowedPostTypes != null && !allowedPostTypes.includes(postType)) return fallback
    return postType
  })()
  // Optional topic from URL / caller (e.g. topic stream, funding round). Spaces/views do not load chat rooms.
  const topicName = customTopicName || (routeParams.topicName && decodeURIComponent(routeParams.topicName))
  const topic = useSelector(state => getTopicForCurrentRoute(state, topicName))

  const { loadedData: serverLoadedData, isLoaded: serverDraftLoaded, saveDraft: saveServerDraft, cancelPendingSave, clearDraft } = useDraft({
    type: 'post',
    postId: editing ? editingPostId : undefined,
    groupId: currentGroup?.id,
    postType: editing ? undefined : createPostType,
    isEdit: editing,
    navigateTo: navigateToForDraft,
    debounceMs: 1500,
    skip: !currentUser
  })

  // Stable key used to detect context changes (group / post type)
  const draftContextKey = useMemo(() => {
    if (editing) return `edit:${editingPostId}`
    return `new:${currentGroup?.id || 'none'}:${createPostType || 'none'}`
  }, [editing, editingPostId, currentGroup?.id, createPostType])

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
  /** True after post had title or description draft content — delete server draft when both cleared. */
  const postComposerHadBodyDraftRef = useRef(false)
  const inSessionDraftByTypeRef = useRef({})
  const pendingTypeSwitchRef = useRef(null)
  /** Set to true when the post has been successfully submitted, preventing draft saves during teardown/navigation. */
  const isSubmittedRef = useRef(false)
  /** Blocks duplicate create/update dispatches before Redux pending state updates. */
  const isSubmittingRef = useRef(false)
  /**
   * Latest editor HTML. Kept in a ref so typing does not write into React state on every keystroke.
   * null means not hydrated yet — draft effect falls back to currentPost.details.
   */
  const detailsHtmlRef = useRef(null)

  const linkPreview = useSelector(state => getLinkPreview(state)) // TODO: probably not working?
  const fetchLinkPreviewPending = useSelector(state => isPendingFor(FETCH_LINK_PREVIEW, state))
  const uploadAttachmentPending = useSelector(getUploadAttachmentPending)

  const attachmentPostId = (editingPostId || fromPostId)
  const uploadFileAttachmentPending = useSelector(state => getUploadAttachmentPending(state, { type: 'post', id: attachmentPostId, attachmentType: 'file' }))
  const uploadImageAttachmentPending = useSelector(state => getUploadAttachmentPending(state, { type: 'post', id: attachmentPostId, attachmentType: 'image' }))
  const imageAttachments = useSelector(
    state => getAttachments(state, { type: 'post', id: attachmentPostId, attachmentType: 'image' }),
    (a, b) => a.length === b.length && a.every((item, index) => item?.url === b[index]?.url)
  )
  const fileAttachments = useSelector(
    state => getAttachments(state, { type: 'post', id: attachmentPostId, attachmentType: 'file' }),
    (a, b) => a.length === b.length && a.every((item, index) => item?.url === b[index]?.url)
  )
  const postPending = useSelector(state => isPendingFor([CREATE_POST, CREATE_PROJECT, UPDATE_POST], state))
  const loading = useSelector(state => isPendingFor(FETCH_POST, state)) || !!uploadAttachmentPending

  let inputPost = propsPost
  const _editingPost = useSelector(state => getPost(state, editingPostId))
  const editingPost = useMemo(() => presentPost(_editingPost), [_editingPost])
  const _fromPost = useSelector(state => getPost(state, fromPostId))
  const fromPost = useMemo(() => presentPost(_fromPost), [_fromPost])
  const [titleFocused, setTitleFocused] = useState(false)
  const [toFieldFocused, setToFieldFocused] = useState(false)

  let isEditing = false
  if (editing) {
    inputPost = editingPost
    isEditing = !!editingPost || loading
  } else if (fromPostId && fromPost) {
    inputPost = fromPost
    inputPost.title = `Copy of ${fromPost.title.slice(0, MAX_TITLE_LENGTH - 8)}`
  }

  const showImages = !isEmpty(imageAttachments) || uploadImageAttachmentPending
  const showFiles = !isEmpty(fileAttachments) || uploadFileAttachmentPending

  const titleInputRef = useRef()
  const editorRef = useRef()
  const toFieldRef = useRef()
  const endTimeRef = useRef()
  const meetingLinkInputRef = useRef()

  // Track the topic that was injected from the current route so we can
  // replace it when the route changes without touching user-added topics
  const routeTopicIdRef = useRef(topic?.id || null)

  const initialPost = useMemo(() => {
    let prefilledEventTimes = {}
    if (!editing && createPostType === 'event' && eventDateParam && !inputPost?.startTime) {
      try {
        const parsed = DateTimeHelpers.toDateTime(eventDateParam, { locale: getLocaleFromLocalStorage() })
        if (parsed.isValid) {
          prefilledEventTimes = DateTimeHelpers.defaultEventTimesForDate(eventDateParam, getLocaleFromLocalStorage())
        }
      } catch {}
    }

    return {
      acceptContributions: false,
      completionAction: 'button',
      completionActionSettings: currentTrack?.actionDescriptor ? { instructions: t('postCompletionActions.button.instructions', { actionDescriptor: currentTrack?.actionDescriptor }) } : null,
      details: '',
      groups: currentGroup ? [currentGroup] : [],
      isAnonymousVote: false,
      isPublic: context === 'public',
      isStrictProposal: false,
      meetingLink: '',
      proposalOptions: [],
      quorum: 0,
      timezone: DateTimeHelpers.getCurrentTimezone(),
      title: '',
      topics: topic ? [topic] : [],
      type: createPostType,
      votingMethod: VOTING_METHOD_SINGLE,
      ...(inputPost || {}),
      ...prefilledEventTimes,
      location: inputPost?.location || selectedLocation || '',
      locationId: inputPost?.locationId || null,
      startTime: typeof inputPost?.startTime === 'string' ? new Date(inputPost.startTime) : (inputPost?.startTime || prefilledEventTimes.startTime),
      endTime: typeof inputPost?.endTime === 'string' ? new Date(inputPost.endTime) : (inputPost?.endTime || prefilledEventTimes.endTime)
    }
  }, [inputPost?.id, inputPost?.location, inputPost?.locationId, createPostType, currentGroup, topic, context, editing, eventDateParam, inputPost?.startTime, inputPost?.endTime, currentTrack?.actionDescriptor, selectedLocation, t])

  const [currentPost, setCurrentPostState] = useState(initialPost)
  const [editorInitialContent, setEditorInitialContent] = useState(initialPost.details || '')
  const [typeSwitchDialog, setTypeSwitchDialog] = useState(null)
  const [invalidMessage, setInvalidMessage] = useState('')
  const [hasDescription, setHasDescription] = useState(initialPost.details?.length > 0) // TODO: an optimization to not run isValid no every character changed in the description
  const [announcementSelected, setAnnouncementSelected] = useState(false)
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [showAllSubmissionCriteria, setShowAllSubmissionCriteria] = useState(false)
  const [shouldShowSubmissionCriteriaToggle, setShouldShowSubmissionCriteriaToggle] = useState(false)
  const submissionCriteriaRef = useRef(null)
  const [titleLengthError, setTitleLengthError] = useState(initialPost.title?.length >= MAX_TITLE_LENGTH)
  const [dateError, setDateError] = useState(false)
  const [showLocation, setShowLocation] = useState(POST_TYPES_SHOW_LOCATION_BY_DEFAULT.includes(initialPost.type) || selectedLocation)

  // Bumped after membership spaces load so To options recompute with parentId/acceptedPostTypes
  const [membershipSpacesTick, setMembershipSpacesTick] = useState(0)

  // Use Membership rows (same source as SpaceContent after join), not Me.memberships.
  // joinSpace extracts a Membership but does not append it to Me.memberships, so the
  // To field would otherwise stay empty until a later Me refetch.
  const groupOptions = useMemo(() => {
    const groups = (myMemberships || [])
      .map((m) => m.group)
      .filter((g) => {
        if (!g) return false
        if (g.status === 'archived') return false
        // Filter out paywalled groups where user doesn't have access
        if (g.paywall && g.canAccess === false) {
          return false
        }
        return true
      })

    if (
      currentGroup?.id &&
      currentGroup.status !== 'archived' &&
      !groups.some(g => sameGroupId(g.id, currentGroup.id))
    ) {
      groups.push(currentGroup)
    }

    return groups.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [myMemberships, currentGroup, membershipSpacesTick])
  const isAction = currentPost.type === 'action'
  const isSubmission = currentPost.type === 'submission'

  const myAdminGroups = useSelector(state => getMyAdminGroups(state, groupOptions))

  const initialDraftPayload = useMemo(() => buildPostDraftPayload(initialPost), [initialPost])

  const setCurrentPost = useCallback((value) => {
    if (typeof value === 'function') {
      setCurrentPostState(prev => {
        const next = value(prev)
        return next === prev ? prev : next
      })
    } else {
      setCurrentPostState(prev => {
        return value === prev ? prev : value
      })
    }
  }, [])

  // Debounced write of editor HTML into React state. Typing stays in TipTap + detailsHtmlRef;
  // this only syncs for draft persistence (avoids re-rendering the whole form per keystroke).
  const syncDetailsToCurrentPost = useRef(
    debounce(400, (html) => {
      setCurrentPostState(prev => (prev.details === html ? prev : { ...prev, details: html }))
    })
  ).current

  const applyPostToEditor = useCallback((nextPost) => {
    let post = nextPost
    if (!editing && currentGroup?.id) {
      const hasCurrentGroup = post.groups?.some(g => sameGroupId(g?.id, currentGroup.id))
      if (!hasCurrentGroup) {
        post = { ...post, groups: [currentGroup, ...(post.groups || [])] }
      }
    }
    syncDetailsToCurrentPost.cancel()
    setCurrentPostState(post)
    const details = post.details || ''
    detailsHtmlRef.current = details
    setHasDescription(hasDraftContent(details))
    setEditorInitialContent(details)
    editorRef.current?.setContent(details)
    draftLoadedRef.current = true
  }, [currentGroup, editing, syncDetailsToCurrentPost])

  /**
   * Filters the available group options to find only those groups
   * that are currently selected in the post.
   * This creates an intersection between all available groups and selected groups,
   * ensuring we only work with valid, accessible groups that the user has selected.
   * @returns {Array} Array of group objects that are both available and selected

  Might be worth cross-checking the use of selectedGroups (which is consistent in data shape),
  and currentPost.groups (which is not consistent in data shape). https://github.com/Hylozoic/hylo/discussions/605
  */

  useEffect(() => {
    draftLoadedRef.current = false
    detailsHtmlRef.current = initialPost.details || ''
    postComposerHadBodyDraftRef.current = false
  }, [draftContextKey, initialPost.details])

  useEffect(() => {
    if (isSubmittedRef.current) return
    if (!serverDraftLoaded || draftLoadedRef.current) return
    const activeType = createPostType
    const serverDraft = loadDraftJSON()
    const sessionDraft = inSessionDraftByTypeRef.current[activeType]
    const mergedServerPost = mergeDraftIntoPost(initialPost, serverDraft, groupOptions)

    const pendingTypeSwitch = pendingTypeSwitchRef.current
    if (!editing && pendingTypeSwitch?.toType === activeType) {
      pendingTypeSwitchRef.current = null
      const carriedPost = mergeDraftIntoPost(initialPost, pendingTypeSwitch.carriedPayload, groupOptions)
      const hasSavedForTarget = !!serverDraft && hasPostDraftPayloadContent(serverDraft)
      const hasCarriedContent = hasPostDraftPayloadContent(pendingTypeSwitch.carriedPayload)

      if (hasSavedForTarget && hasCarriedContent) {
        setTypeSwitchDialog({
          targetType: activeType,
          carriedPost,
          savedPost: mergedServerPost
        })
      }

      applyPostToEditor(carriedPost)
      return
    }

    const mergedPost = mergeDraftIntoPost(initialPost, sessionDraft || serverDraft, groupOptions)
    applyPostToEditor(mergedPost)
  }, [applyPostToEditor, createPostType, draftContextKey, editing, serverDraftLoaded, groupOptions, initialPost, loadDraftJSON])

  useEffect(() => {
    if (editing || !currentGroup?.id) return
    setCurrentPost(prev => {
      const hasCurrentGroup = prev.groups?.some(g => sameGroupId(g?.id, currentGroup.id))
      if (hasCurrentGroup) return prev
      return { ...prev, groups: [currentGroup, ...(prev.groups || [])] }
    })
  }, [currentGroup, editing, setCurrentPost])

  // Flush pending details into currentPost on unmount so drafts are not truncated.
  useEffect(() => () => {
    syncDetailsToCurrentPost.flush?.()
    syncDetailsToCurrentPost.cancel()
  }, [syncDetailsToCurrentPost])

  // Persist structural updates (title, metadata, etc.) whenever the draft changes after initial hydration.
  // When the user edits before the server responds, mark draftLoadedRef = true immediately so the
  // server load effect cannot overwrite their changes when the response eventually arrives.
  //
  // When the payload matches initial values we only reset local dirty state.
  // When title and description are both empty, cancel pending saves and delete the server draft
  // if the user had draft body content this session.
  useEffect(() => {
    if (isSubmittedRef.current) return
    if (typeSwitchDialog) return
    // Prefer live editor HTML so title/metadata draft saves include latest typing
    // even before the debounced details → currentPost sync lands.
    const details = detailsHtmlRef.current ?? (currentPost.details || '')
    const postForDraft = details === currentPost.details
      ? currentPost
      : { ...currentPost, details }

    const payload = buildPostDraftPayload(postForDraft)

    if (!hasPostDraftPayloadContent(payload)) {
      saveServerDraft(JSON.stringify(payload))
      setIsDirty(false)
      if (postComposerHadBodyDraftRef.current) {
        postComposerHadBodyDraftRef.current = false
        clearDraft({ deleteOnServer: true }).catch(() => {})
      }
      if (!isEqual(payload, initialDraftPayload)) {
        draftLoadedRef.current = true
      }
      return
    }

    postComposerHadBodyDraftRef.current = true

    if (!isEqual(payload, initialDraftPayload)) {
      draftLoadedRef.current = true
      saveDraftJSON(payload)
      setIsDirty(true)
      return
    }
    setIsDirty(false)
  }, [currentPost, initialDraftPayload, saveDraftJSON, saveServerDraft, setIsDirty, typeSwitchDialog, clearDraft])

  const selectedGroups = useMemo(() => {
    if (!groupOptions || !currentPost?.groups) return []
    return groupOptions.filter((g) =>
      g && currentPost.groups.some((g2) => g2 && sameGroupId(g.id, g2.id))
    )
  }, [currentPost?.groups, groupOptions])

  // Extract groupIds array for scoping topic and mention searches
  // Priority:
  // 1. Use selectedGroups if available (most common case - user has selected groups)
  // 2. For public posts with no groups, allow all accessible topics/people (pass undefined)
  // 3. Otherwise, fallback to currentGroup from route context
  // Passing undefined allows backend to return all accessible topics/people based on user's group memberships
  const groupIds = useMemo(() => {
    if (selectedGroups && selectedGroups.length > 0) {
      return selectedGroups.map(g => g.id).filter(Boolean)
    }
    // For public posts with no groups selected, allow all accessible topics/people
    if (currentPost.isPublic && (!currentPost.groups || currentPost.groups.length === 0)) {
      return undefined
    }
    // Fallback to currentGroup from route context
    if (currentGroup?.id) {
      return [currentGroup.id]
    }
    // No groups available - allow all accessible topics/people
    return undefined
  }, [selectedGroups, currentGroup, currentPost.isPublic, currentPost.groups])

  const toOptions = useMemo(() => {
    if (!groupOptions) return []

    const postTypeForOptions = currentPost.type
    const topLevelGroups = groupOptions.filter(g => g && !isSpaceGroup(g))
    const spaces = groupOptions.filter(g => g && isSpaceGroup(g))
    const currentTopLevelId = currentGroup?.parentId || currentGroup?.id

    // Current top-level group first, then alphabetically; only groups that accept this post type
    const sortedTopLevel = [...topLevelGroups]
      .filter(g => groupAcceptsPostType(g, postTypeForOptions))
      .sort((a, b) => {
        const aIsCurrent = String(a.id) === String(currentTopLevelId)
        const bIsCurrent = String(b.id) === String(currentTopLevelId)
        if (aIsCurrent && !bIsCurrent) return -1
        if (!aIsCurrent && bIsCurrent) return 1
        return a.name.localeCompare(b.name)
      })

    return sortedTopLevel.flatMap((parent) => {
      const options = [{
        id: parent.id,
        group: parent,
        name: parent.name,
        avatarUrl: parent.avatarUrl,
        allowInPublic: parent.allowInPublic,
        isSpace: false
      }]

      const childSpaces = spaces
        .filter(space =>
          String(space.parentId) === String(parent.id) &&
          groupAcceptsPostType(space, postTypeForOptions)
        )
        .sort((a, b) => a.name.localeCompare(b.name))

      childSpaces.forEach(space => {
        options.push({
          id: space.id,
          group: space,
          parentGroup: parent,
          name: `${parent.name} / ${space.name}`,
          avatarUrl: parent.avatarUrl,
          icon: space.icon,
          allowInPublic: space.allowInPublic,
          isSpace: true
        })
      })

      return options
    })
  }, [groupOptions, currentGroup?.id, currentGroup?.parentId, currentPost.type])

  const selectedToOptions = useMemo(() => {
    return selectedGroups.map((g) => {
      if (!g) return null

      if (isSpaceGroup(g)) {
        const parent = groupOptions.find(p => p && String(p.id) === String(g.parentId))
        return {
          id: g.id,
          group: g,
          parentGroup: parent,
          name: parent ? `${parent.name} / ${g.name}` : g.name,
          avatarUrl: parent?.avatarUrl || g.avatarUrl,
          icon: g.icon,
          isSpace: true
        }
      }

      return {
        id: g.id,
        group: g,
        name: g.name,
        avatarUrl: g.avatarUrl,
        isSpace: false
      }
    }).filter(Boolean)
  }, [selectedGroups, groupOptions])

  useEffect(() => {
    if (currentTrack?.actionDescriptor && !currentPost.completionActionSettings) {
      setCurrentPost(prev => {
        if (prev.completionActionSettings) return prev
        return {
          ...prev,
          completionActionSettings: { instructions: t('postCompletionActions.button.instructions', { actionDescriptor: currentTrack?.actionDescriptor }) }
        }
      })
    }
  }, [currentPost.completionActionSettings, currentTrack?.actionDescriptor, setCurrentPost, t])

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => { titleInputRef.current && titleInputRef.current.focus() }, 100)
    }
    return () => {
      dispatch(clearLinkPreview())
      dispatch(clearAttachments('post', 'new', 'image'))
    }
  }, [])

  // Fetch membership spaces so the To field has destinations from every group
  const hasFetchedToFieldDataRef = useRef(false)
  useEffect(() => {
    if (hasFetchedToFieldDataRef.current) return
    hasFetchedToFieldDataRef.current = true
    Promise.resolve(dispatch(fetchAllMyGroupsSpaces())).finally(() => {
      setMembershipSpacesTick(tick => tick + 1)
    })
  }, [dispatch])

  useEffect(() => {
    setShowLocation(POST_TYPES_SHOW_LOCATION_BY_DEFAULT.includes(initialPost.type) || selectedLocation)
  }, [initialPost.type])

  useEffect(() => {
    if (initialPost.id) reset()
  }, [initialPost.id])

  useEffect(() => {
    setCurrentPost(prev => (prev.linkPreview === linkPreview ? prev : { ...prev, linkPreview }))
  }, [linkPreview, setCurrentPost])

  useEffect(() => {
    // When switching between topic streams (route topic changes), reset topics to only the new route topic
    setCurrentPost(prev => {
      // If route topic changed, reset topics to only contain the new route topic
      if (topic?.id && topic.id !== routeTopicIdRef.current) {
        routeTopicIdRef.current = topic.id
        return { ...prev, topics: [topic] }
      }

      // If route topic was removed, clear route topic reference
      if (!topic?.id && routeTopicIdRef.current) {
        const priorTopicId = routeTopicIdRef.current
        routeTopicIdRef.current = null
        // Remove the prior route topic if it exists
        const nextTopics = (prev.topics || []).filter(t => t && t.id !== priorTopicId)
        return { ...prev, topics: nextTopics }
      }

      // If route topic is the same, ensure it's present
      if (topic?.id && topic.id === routeTopicIdRef.current) {
        const exists = prev.topics?.some(t => t && t.id === topic.id)
        if (!exists) {
          return { ...prev, topics: [...(prev.topics || []), topic] }
        }
      }

      return prev
    })
  }, [topic?.id])

  useEffect(() => {
    setCurrentPost(prev => (prev.sendAnnouncement === announcementSelected ? prev : { ...prev, sendAnnouncement: announcementSelected }))
  }, [announcementSelected, setCurrentPost])

  /**
   * Resets the editor to its initial state
   * Clears form fields, attachments, and link previews
   */
  const reset = useCallback(() => {
    syncDetailsToCurrentPost.cancel()
    const details = initialPost.details || ''
    detailsHtmlRef.current = details
    editorRef.current?.setContent(details)
    setHasDescription(details.length > 0)
    dispatch(clearLinkPreview())
    setCurrentPost(() => ({ ...initialPost, linkPreview: null, linkPreviewFeatured: false }))
    setEditorInitialContent(details)
    dispatch(clearAttachments('post', 'new', 'image'))
    dispatch(clearAttachments('post', 'new', 'file'))
    setShowLocation(POST_TYPES_SHOW_LOCATION_BY_DEFAULT.includes(initialPost.type) || selectedLocation)
    setAnnouncementSelected(false)
    setShowAnnouncementModal(false)
    clearDraft()
    postComposerHadBodyDraftRef.current = false
    isSubmittedRef.current = false
    setIsDirty(false)
    if (autoFocus) {
      toFieldRef?.current?.reset()
      setTimeout(() => { titleInputRef.current && titleInputRef.current.focus() }, 100)
    } else {
      toFieldRef?.current?.reset()
    }
  }, [clearDraft, initialPost, autoFocus, selectedLocation, setCurrentPost, syncDetailsToCurrentPost])

  /**
   * Calculates an end time based on start time, preserving duration if both times exist
   * @param {Date} startTime - The new start time
   * @returns {Date} - The calculated end time
   */
  const getPostTimezone = useCallback(() => {
    return currentPost.timezone || DateTimeHelpers.getCurrentTimezone()
  }, [currentPost.timezone])

  const calcEndTime = useCallback((startInstant) => {
    const tz = getPostTimezone()
    let msDiff = 3600000 // ms in one hour
    if (currentPost.startTime && currentPost.endTime) {
      const start = DateTimeHelpers.toDateTime(currentPost.startTime, { timezone: tz })
      const end = DateTimeHelpers.toDateTime(currentPost.endTime, { timezone: tz })
      msDiff = end.diff(start).milliseconds
    }
    return DateTimeHelpers.toDateTime(startInstant, { timezone: tz }).plus({ milliseconds: msDiff }).toJSDate()
  }, [currentPost.startTime, currentPost.endTime, getPostTimezone])

  const handlePostTypeSelection = useCallback((type) => {
    if (type === currentPost.type) return

    syncDetailsToCurrentPost.flush?.()
    const postWithDetails = {
      ...currentPost,
      details: detailsHtmlRef.current ?? currentPost.details
    }
    const currentPayload = buildPostDraftPayload(postWithDetails)
    inSessionDraftByTypeRef.current[currentPost.type] = currentPayload
    pendingTypeSwitchRef.current = {
      fromType: currentPost.type,
      toType: type,
      carriedPayload: {
        ...currentPayload,
        type
      }
    }

    navigate({
      pathname: urlLocation.pathname,
      search: setQuerystringParam('newPostType', type, urlLocation)
    }, { replace: true })

    setCurrentPost(prev => ({
      ...prev,
      type,
      details: postWithDetails.details,
      // Drop destinations that do not accept the newly selected post type
      groups: (prev.groups || []).filter(g => groupAcceptsPostType(g, type))
    }))
    setTimeout(() => { titleInputRef.current && titleInputRef.current.focus() }, 100)
  }, [currentPost, navigate, setCurrentPost, syncDetailsToCurrentPost, urlLocation])

  const handleKeepCurrentTypeContent = useCallback(() => {
    if (typeSwitchDialog?.targetType && typeSwitchDialog?.carriedPost) {
      inSessionDraftByTypeRef.current[typeSwitchDialog.targetType] = buildPostDraftPayload(typeSwitchDialog.carriedPost)
    }
    setTypeSwitchDialog(null)
  }, [typeSwitchDialog])

  const handleLoadSavedTypeDraft = useCallback(() => {
    if (!typeSwitchDialog?.savedPost || !typeSwitchDialog?.targetType) {
      setTypeSwitchDialog(null)
      return
    }

    inSessionDraftByTypeRef.current[typeSwitchDialog.targetType] = buildPostDraftPayload(typeSwitchDialog.savedPost)
    applyPostToEditor(typeSwitchDialog.savedPost)
    setTypeSwitchDialog(null)
  }, [applyPostToEditor, typeSwitchDialog])

  const handleTitleChange = useCallback((event) => {
    const title = event.target.value
    setTitleLengthError(title.length >= MAX_TITLE_LENGTH)
    setCurrentPost(prev => (title === prev.title ? prev : { ...prev, title }))
  }, [setCurrentPost])

  /**
   * TipTap onUpdate handler. Avoid putting full HTML into React state on every keystroke —
   * that re-renders the entire PostEditor and causes typing lag / out-of-order characters
   * as content grows. Keep HTML in a ref; only flip hasDescription when emptiness changes;
   * debounce syncing details into currentPost for draft persistence.
   */
  const handleDetailsChange = useCallback((html) => {
    detailsHtmlRef.current = html
    const hasContent = (editorRef.current?.getText?.() || '').length > 0
    // queueMicrotask: TipTap updates synchronously; deferring avoids render-cycle conflicts
    // that can surface as characters appearing out of order under load.
    queueMicrotask(() => {
      setHasDescription(prev => (prev === hasContent ? prev : hasContent))
      syncDetailsToCurrentPost(html)
    })
  }, [syncDetailsToCurrentPost])

  const handleBudgetChange = useCallback((evt) => {
    const budget = evt.target.value
    setCurrentPost({ ...currentPost, budget })
  }, [currentPost])

  /**
   * Validates time inputs to ensure end time is after start time
   * @param {Date} startTime - The start time to validate
   * @param {Date} endTime - The end time to validate
   */
  const validateTimeChange = useCallback((startTime, endTime) => {
    if (endTime) {
      startTime < endTime
        ? setDateError(false)
        : setDateError(true)
    }
  }, [])

  const handleToggleContributions = useCallback(() => {
    setCurrentPost(prev => ({ ...prev, acceptContributions: !prev.acceptContributions }))
  }, [setCurrentPost])

  const handleStartTimeChange = (pickerStart) => {
    const tz = getPostTimezone()
    const startTime = DateTimeHelpers.fromPickerDate(pickerStart, tz)
    const endTime = calcEndTime(startTime)
    validateTimeChange(startTime, endTime)
    setCurrentPost(prev => ({ ...prev, startTime, endTime }))
    endTimeRef.current?.setValue(DateTimeHelpers.toPickerDate(endTime, tz))
  }

  const handleEndTimeChange = useCallback((pickerEnd) => {
    const tz = getPostTimezone()
    const endTime = DateTimeHelpers.fromPickerDate(pickerEnd, tz)
    setCurrentPost(prev => {
      validateTimeChange(prev.startTime, endTime)
      return { ...prev, endTime }
    })
  }, [getPostTimezone, validateTimeChange])

  const handleTimezoneChange = useCallback((newTimezone) => {
    setCurrentPost(prev => {
      const oldTimezone = prev.timezone || DateTimeHelpers.getCurrentTimezone()
      return {
        ...prev,
        timezone: newTimezone,
        startTime: DateTimeHelpers.preserveWallClockOnTimezoneChange(prev.startTime, oldTimezone, newTimezone),
        endTime: DateTimeHelpers.preserveWallClockOnTimezoneChange(prev.endTime, oldTimezone, newTimezone)
      }
    })
  }, [])

  const handleDonationsLinkChange = useCallback((evt) => {
    const donationsLink = evt.target.value
    setCurrentPost(prev => ({ ...prev, donationsLink }))
  }, [setCurrentPost])

  const handleProjectManagementLinkChange = useCallback((evt) => {
    const projectManagementLink = evt.target.value
    setCurrentPost(prev => ({ ...prev, projectManagementLink }))
  }, [setCurrentPost])

  const handleMeetingLinkChange = useCallback((evt) => {
    const meetingLink = evt.target.value
    setCurrentPost(prev => ({ ...prev, meetingLink }))
  }, [setCurrentPost])

  const handleLocationChange = useCallback((locationObject) => {
    setCurrentPost(prev => ({
      ...prev,
      location: locationObject.fullText,
      locationId: locationObject.id
    }))
  }, [setCurrentPost])

  // The useRef and useEventCallback is needed to make sure the currentPost.linkPreview is updated in the debounce function
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

  const handleAddToOption = useCallback((toOptions) => {
    const groups = uniqBy('id', toOptions.map(toOption => toOption.group).filter(Boolean))
    setCurrentPost(prev => ({ ...prev, groups }))
  }, [setCurrentPost])

  /** Removes a selected group or space destination from the To field. */
  const handleToOptionDelete = useCallback((deletedOption, allSelected) => {
    const groupId = deletedOption.group?.id
    return allSelected.filter(o => o.group?.id !== groupId)
  }, [])

  const togglePublic = useCallback(() => {
    setCurrentPost(prev => ({ ...prev, isPublic: !prev.isPublic }))
  }, [setCurrentPost])

  const toggleAnonymousVote = useCallback(() => {
    setCurrentPost(prev => ({ ...prev, isAnonymousVote: !prev.isAnonymousVote }))
  }, [setCurrentPost])

  // const toggleStrictProposal = () => {
  //   const { isStrictProposal } = currentPost
  //   setCurrentPost({ ...currentPost, isStrictProposal: !isStrictProposal })
  // }

  const handleUpdateProjectMembers = useCallback((members) => {
    setCurrentPost(prev => ({ ...prev, members }))
  }, [setCurrentPost])

  const handleUpdateEventInvitations = useCallback((eventInvitations) => {
    setCurrentPost(prev => ({ ...prev, eventInvitations }))
  }, [setCurrentPost])

  /**
   * Determines if the current form state is valid for submission
   * Checks various conditions based on post type and sets error messages
   */
  const isValid = useMemo(() => {
    const { type, title, groups, startTime, endTime, donationsLink, projectManagementLink, meetingLink, proposalOptions, budget } = currentPost

    const errorMessages = []

    switch (type) {
      case 'event':
        if (!endTime || !startTime || startTime >= endTime) {
          errorMessages.push(t('Valid start and end time required'))
        }
        if (meetingLink?.length > 0 && !sanitizeURL(meetingLink)) {
          errorMessages.push(t('Video call link must be a valid URL'))
        }
        break
      case 'project':
        if ((donationsLink?.length > 0 && !sanitizeURL(donationsLink)) || (projectManagementLink?.length > 0 && !sanitizeURL(projectManagementLink))) {
          errorMessages.push(t('Donations and project management links must be valid URLs'))
        }
        break
      case 'proposal':
        if (proposalOptions?.length === 0) {
          errorMessages.push(t('At least one proposal option required'))
        }
        break
      case 'submission':
        if (currentFundingRound?.requireBudget && !budget) {
          errorMessages.push(t('Budget is required for this submission'))
        }
        break
    }

    if (title?.length === 0 || title?.length > MAX_TITLE_LENGTH) {
      errorMessages.push(t('Title is required'))
    }

    if (groups?.length === 0) {
      errorMessages.push(t('At least one group required'))
    }

    if (errorMessages.length > 0) {
      setInvalidMessage(errorMessages.join('<br />'))
    }

    return errorMessages.length === 0
  }, [hasDescription, currentPost.type, currentPost.title, currentPost.groups, currentPost.startTime, currentPost.endTime, currentPost.donationsLink, currentPost.projectManagementLink, currentPost.meetingLink, currentPost.proposalOptions, currentPost.budget, currentFundingRound?.requireBudget])

  // const handleCancel = () => {
  //   if (onCancel) {
  //     onCancel()
  //     return true
  //   }
  // }

  /**
   * Saves the post to the server
   * Collects all form data and dispatches the appropriate action (create or update)
   */
  const save = useCallback(async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    try {
      const {
        acceptContributions,
        budget,
        completionAction,
        completionActionSettings,
        donationsLink,
        endTime,
        eventInvitations,
        groups,
        id,
        isAnonymousVote,
        isPublic,
        isStrictProposal,
        linkPreview,
        linkPreviewFeatured,
        locationId,
        meetingLink,
        members,
        projectManagementLink,
        proposalOptions,
        votingMethod,
        quorum,
        startTime,
        timezone,
        title,
        topics,
        type
      } = currentPost
      const details = editorRef.current.getHTML()
      const topicNames = topics?.map((t) => t.name)
      const memberIds = members?.map((m) => m.id) || []
      if (type === 'project') {
        // Add the current user to the project members
        memberIds.push(currentUser.id)
      }
      const eventInviteeIds =
        eventInvitations && eventInvitations.map((m) => m.id)
      const imageUrls =
        imageAttachments && imageAttachments.map((attachment) => attachment.url)
      const fileUrls =
        fileAttachments && fileAttachments.map((attachment) => attachment.url)
      const postLocation = currentPost.location || selectedLocation
      const actualLocationId = await ensureLocationIdIfCoordinate({
        fetchLocation: (data) => dispatch(fetchLocation(data)),
        location: postLocation,
        locationId
      })
      const meetingLinkValue = meetingLinkInputRef.current?.value ?? meetingLink

      const postToSave = {
        id,
        acceptContributions,
        budget,
        commenters: [], // For optimistic display of the new post
        createdAt: DateTimeHelpers.dateTimeNow(getLocaleFromLocalStorage()).toISO(), // For optimistic display of the new post
        creator: currentUser, // For optimistic display of the new post
        completionAction,
        completionActionSettings,
        details,
        donationsLink: sanitizeURL(donationsLink),
        endTime,
        eventInviteeIds,
        fileAttachments, // For optimistic display of the new post
        fileUrls,
        fundingRoundId: currentFundingRound?.id,
        groups,
        imageAttachments, // For optimistic display of the new post
        imageUrls,
        isAnonymousVote,
        isPublic,
        isStrictProposal,
        linkPreview,
        linkPreviewFeatured,
        localId: uniqueId('post_'), // For optimistic display of the new post
        location: postLocation,
        locationId: actualLocationId,
        meetingLink: sanitizeURL(meetingLinkValue?.trim()),
        memberIds,
        pending: true, // For optimistic display of the new post
        projectManagementLink: sanitizeURL(projectManagementLink),
        proposalOptions: proposalOptions.map(({ color, emoji, text, id }) => {
          return { color, text, emoji, id }
        }),
        votingMethod,
        quorum,
        sendAnnouncement: announcementSelected,
        startTime,
        timezone,
        title,
        topicNames,
        trackId: currentTrack?.id,
        markAsReadTopicName,
        viewId,
        type
      }

      const saveFunc = isEditing ? updatePost : createPost
      setAnnouncementSelected(false)
      if (onSave) onSave(postToSave)
      // Prevent any draft saves triggered by re-renders during or after the mutation.
      isSubmittedRef.current = true
      // Drop pending details→state sync and cancel in-flight draft save so neither
      // fires during the async mutation. Save already reads HTML from the editor.
      syncDetailsToCurrentPost.cancel()
      cancelPendingSave()

      const savedPost = await dispatch(saveFunc(postToSave))
      if (!savedPost.error) {
        await clearDraft()
        setIsDirty(false)
        if (afterSave) {
          const returnedPost = isEditing
            ? savedPost?.payload?.data?.updatePost
            : savedPost?.payload?.data?.createPost
          afterSave(returnedPost)
        }
      } else {
        isSubmittingRef.current = false
      }
    } catch (error) {
      isSubmittingRef.current = false
      throw error
    }
  }, [afterSave, announcementSelected, cancelPendingSave, clearDraft, currentFundingRound?.id, currentPost, currentTrack?.id, currentUser, dispatch, fileAttachments, imageAttachments, isEditing, onSave, selectedLocation, setIsDirty, syncDetailsToCurrentPost, viewId])

  /**
   * Initiates the save process with validation and confirmation checks
   * Shows announcement modal or warning if needed
   */
  const doSave = useEventCallback(() => {
    if (!isValid || loading || postPending) return

    const _save = announcementSelected ? toggleAnnouncementModal : save
    if (currentPost.type === 'proposal' && isEditing) {
      if (window.confirm(t('Changing proposal options will reset the votes. Are you sure you want to continue?'))) {
        _save()
      }
    } else {
      _save()
    }
  }, [announcementSelected, currentPost.type, currentPost.proposalOptions, isEditing, isValid, initialPost.proposalOptions, save, loading, postPending])

  // Allow parents (e.g. CreateModal) to trigger save/reset flows without duplicating editor logic
  useImperativeHandle(ref, () => ({
    submit: () => doSave(),
    resetToInitial: () => reset()
  }))

  const buttonLabel = useCallback(() => {
    if (postPending) return t('Posting...')
    if (isEditing) return t('Save')
    return t('Post')
  }, [postPending, isEditing])

  const toggleAnnouncementModal = useCallback(() => {
    setShowAnnouncementModal(!showAnnouncementModal)
  }, [showAnnouncementModal])

  const handleSetQuorum = useCallback((quorum) => {
    setCurrentPost(prev => ({ ...prev, quorum }))
  }, [setCurrentPost])

  const handleSetProposalType = useCallback((votingMethod) => {
    setCurrentPost(prev => ({ ...prev, votingMethod }))
  }, [setCurrentPost])

  /**
   * Applies a proposal template to the current post
   * @param {string} template - Template identifier
   */
  const handleUseTemplate = useCallback((template) => {
    const templateData = PROPOSAL_TEMPLATES[template]
    setCurrentPost(prev => ({
      ...prev,
      proposalOptions: templateData.form.proposalOptions.map(option => { return { ...option, tempId: generateTempID() } }),
      title: prev.title.length > 0 ? prev.title : templateData.form.title,
      quorum: templateData.form.quorum,
      votingMethod: templateData.form.votingMethod
    }))
  }, [setCurrentPost])

  const handleAddOption = useCallback(() => {
    setCurrentPost(prev => {
      const newOptions = [...(prev.proposalOptions || []), { text: '', emoji: '', color: '', tempId: generateTempID() }]
      return { ...prev, proposalOptions: newOptions }
    })
  }, [setCurrentPost])

  /**
   * Checks if the current user can make an announcement in all selected groups
   * @returns {boolean} - True if user has admin rights in all selected groups
   */
  const canMakeAnnouncement = useCallback(() => {
    if (currentPost.type === 'action' || currentPost.type === 'submission') return false
    const { groups = [] } = currentPost
    const myAdminGroupsSlugs = myAdminGroups.map(group => group.slug)
    for (let index = 0; index < groups.length; index++) {
      if (!myAdminGroupsSlugs.includes(groups[index].slug)) return false
    }
    return true
  }, [currentPost, myAdminGroups])

  const canHaveTimes = !['discussion', 'action', 'submission'].includes(currentPost.type)
  const eventTimezone = currentPost.timezone || DateTimeHelpers.getCurrentTimezone()
  const startTimePickerValue = currentPost.startTime
    ? DateTimeHelpers.toPickerDate(currentPost.startTime, eventTimezone)
    : undefined
  const endTimePickerValue = currentPost.endTime
    ? DateTimeHelpers.toPickerDate(currentPost.endTime, eventTimezone)
    : undefined
  const postLocation = currentPost.location || selectedLocation
  const locationPrompt = currentPost.type === 'proposal'
    ? t('Is there a relevant location for this proposal?')
    : currentPost.type === 'event'
      ? t('Where is the event taking place?')
      : t('Where is your {{type}} located?', { type: currentPost.type })
  const locationLabel = currentPost.type === 'event' ? t('Venue') : t('Location')
  const hasStripeAccount = get('hasStripeAccount', currentUser)

  /**
   * Handles the To field container click, focusing the actual ToField
   * This improves UX by making the entire container clickable
   */
  const handleToFieldContainerClick = () => {
    toFieldRef.current?.focus() // This will call the focus method on ToField
  }

  useEffect(() => {
    setShowAllSubmissionCriteria(false)
    setShouldShowSubmissionCriteriaToggle(false)
  }, [isSubmission, currentFundingRound?.id])

  const showSubmissionCriteria = useMemo(() => isSubmission && currentFundingRound?.criteria && !!(new DOMParser().parseFromString(currentFundingRound.criteria, 'text/html').body.textContent?.trim()), [isSubmission, currentFundingRound?.criteria])

  useEffect(() => {
    if (!showSubmissionCriteria) {
      setShouldShowSubmissionCriteriaToggle(false)
      return
    }

    if (showAllSubmissionCriteria) return

    const node = submissionCriteriaRef.current
    if (!node) return

    const isOverflowing = node.scrollHeight > node.clientHeight + 1
    setShouldShowSubmissionCriteriaToggle(isOverflowing)
  }, [showSubmissionCriteria, showAllSubmissionCriteria, currentFundingRound?.criteria])

  return (
    <div className={cn('flex flex-col rounded-lg bg-background p-3 shadow-2xl relative gap-4 border-2 border-foreground/30')}>
      <div
        className='absolute -top-[20px] left-0 right-0 h-[20px] bg-gradient-to-t from-black/10 to-transparent'
        style={{
          maskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 40px, rgba(0,0,0,1) calc(100% - 40px), rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 40px, rgba(0,0,0,1) calc(100% - 40px), rgba(0,0,0,0) 100%)'
        }}
      />
      {editorTourInvitation}
      <div className={cn('PostEditorHeader relative')} data-tour='post-type'>
        {isAction
          ? (
            <div className=''>{isEditing ? t('Edit {{actionDescriptor}}', { actionDescriptor: currentTrack?.actionDescriptor }) : t('Add {{actionDescriptor}}', { actionDescriptor: currentTrack?.actionDescriptor })}</div>
            )
          : isSubmission
            ? (
              <div className=''>{isEditing ? t('Edit {{submissionDescriptor}}', { submissionDescriptor: currentFundingRound?.submissionDescriptor || t('Submission') }) : t('Add {{submissionDescriptor}}', { submissionDescriptor: currentFundingRound?.submissionDescriptor || t('Submission') })}</div>
              )
            : (
              <PostTypeSelect
                allowedPostTypes={allowedPostTypes}
                disabled={loading}
                postType={currentPost.type}
                setPostType={handlePostTypeSelection}
                className={cn({ hidden: !!currentFundingRound })}
              />
              )}
      </div>
      {showSubmissionCriteria && (
        <div className='flex flex-col gap-2 rounded-lg border border-foreground/20 bg-foreground/5 p-3 text-xs text-foreground/80'>
          <div className='text-xs uppercase tracking-wide text-foreground/60'>{t('Submission Criteria')}</div>
          <div
            ref={submissionCriteriaRef}
            className={cn(
              'leading-relaxed space-y-2',
              !showAllSubmissionCriteria && 'line-clamp-2'
            )}
          >
            <HyloHTML
              html={currentFundingRound.criteria}
              className={cn(!showAllSubmissionCriteria && 'child:first:mt-0 child:first:mb-0')}
            />
          </div>
          {shouldShowSubmissionCriteriaToggle && (
            <button
              type='button'
              onClick={() => setShowAllSubmissionCriteria(prev => !prev)}
              className='self-start text-xs font-semibold text-foreground underline'
            >
              {showAllSubmissionCriteria ? t('Hide') : t('Show all')}
            </button>
          )}
        </div>
      )}
      {!isAction && !isSubmission && (
        <div
          className={cn('PostEditorTo flex w-full items-center bg-input rounded p-1 border-2 border-transparent transition-all', { 'border-2 border-focus': toFieldFocused })}
          data-tour='post-to'
          onClick={handleToFieldContainerClick}
        >
          <div className='text-xs text-foreground/50 px-2'>{t('To')}</div>
          <div className='border-foreground w-full min-w-0'>
            <ToField
              options={toOptions}
              selected={selectedToOptions}
              onChange={handleAddToOption}
              onDelete={handleToOptionDelete}
              readOnly={loading}
              ref={toFieldRef}
              onFocus={() => setToFieldFocused(true)}
              onBlur={() => setToFieldFocused(false)}
              backgroundClassName='bg-midground rounded-lg p-2 shadow-md'
            />
          </div>
        </div>
      )}
      <div className={cn('PostEditorTitle flex w-full items-center bg-input rounded p-1 transition-all border-2 border-transparent', { 'border-2 border-focus': titleFocused })}>
        <div className='text-xs text-foreground/50 px-2'>{t('Title')}</div>
        <input
          type='text'
          className='bg-transparent focus:outline-none flex-1 placeholder:text-foreground/50 border-transparent'
          value={currentPost.title || ''}
          onChange={handleTitleChange}
          disabled={loading}
          ref={titleInputRef}
          maxLength={MAX_TITLE_LENGTH}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.altKey) {
              doSave()
            }
          }}
        />
        {titleLengthError && (
          <span className='text-black bg-[#FFB949] w-full relative -top-[15px] pb-[2px] px-[10px] rounded-[7px]'>{t('Title limited to {{maxTitleLength}} characters', { maxTitleLength: MAX_TITLE_LENGTH })}</span>
        )}
      </div>
      <div
        className={cn(
          'PostEditorContent w-full bg-input rounded p-1',
          'flex flex-col !items-start border-2 border-transparent shadow-md transition-all duration-200 overflow-x-hidden focus-within:border-2 focus-within:border-focus'
        )}
        data-tour='post-body'
      >
        {currentPost.details === null || loading
          ? <div><Loading /></div>
          : <HyloEditor
              placeholder={t('Add a description')}
              onUpdate={handleDetailsChange}
              onAltEnter={doSave}
              onAddTopic={handleAddTopic}
              onAddLink={handleAddLinkPreview}
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
      {currentPost.type === 'project' && (
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2'>
          <div className='text-xs text-foreground/50 w-[120px]'>{t('Project Members')}</div>
          <div className='w-full'>
            <MemberSelector
              initialMembers={currentPost.members || []}
              onChange={handleUpdateProjectMembers}
              forGroups={currentPost.groups}
              readOnly={loading}
              className='w-full outline-none border-none bg-transparent placeholder:text-foreground/50 pt-0'
              backgroundClassName='bg-midground rounded-lg p-1 shadow-md'
            />
          </div>
        </div>
      )}
      {/* <div className='flex w-full items-center bg-input rounded p-1'>
        <div className='text-sm text-foreground/80 whitespace-nowrap mr-4'>{t('Topics')}</div>
        <div>
          <TopicSelector
            forGroups={selectedGroups && selectedGroups.length > 0 ? selectedGroups : (currentPost?.groups || (currentGroup ? [currentGroup] : []))}
            selectedTopics={currentPost.topics}
            onChange={handleTopicSelectorOnChange}
          />
        </div>
      </div> */}
      {!isAction && !isSubmission && (
        <div className='PostEditorPublic flex w-full items-center bg-input rounded p-1' data-tour='post-public'>
          <PublicToggle
            togglePublic={togglePublic}
            isPublic={!!currentPost.isPublic}
            selectedGroups={selectedGroups}
          />
        </div>
      )}
      {currentPost.type === 'proposal' && currentPost.proposalOptions.length === 0 && (
        <div className='border-2 border-transparent transition-all flex items-center gap-2 bg-input rounded-md p-2'>
          <div className='text-xs text-foreground/50'>{t('Proposal template')}</div>
          <div>
            <Select
              onValueChange={(template) => handleUseTemplate(template)}
            >
              <SelectTrigger className='w-fit border-2 bg-transparent border-foreground/30 rounded-md p-2 text-base'>
                <SelectValue placeholder={t('Select a template')}>
                  <span className='flex items-center gap-2'>
                    {t('Select a template')}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROPOSAL_YESNO}>{t(PROPOSAL_YESNO)}</SelectItem>
                <SelectItem value={PROPOSAL_POLL_SINGLE}>{t(PROPOSAL_POLL_SINGLE)}</SelectItem>
                <SelectItem value={PROPOSAL_MULTIPLE_CHOICE}>{t(PROPOSAL_MULTIPLE_CHOICE)}</SelectItem>
                <SelectItem value={PROPOSAL_ADVICE}>{t(PROPOSAL_ADVICE)}</SelectItem>
                <SelectItem value={PROPOSAL_CONSENT}>{t(PROPOSAL_CONSENT)}</SelectItem>
                <SelectItem value={PROPOSAL_CONSENSUS}>{t(PROPOSAL_CONSENSUS)}</SelectItem>
                <SelectItem value={PROPOSAL_GRADIENT}>{t(PROPOSAL_GRADIENT)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {currentPost.type === 'proposal' && currentPost.proposalOptions && (
        <div className='border-2 border-transparent transition-all flex items-center gap-2 bg-input rounded-md p-2'>
          <div className='text-xs text-foreground/50 w-[130px]'>
            {t('Proposal options')}*
          </div>
          <div className='flex flex-col gap-2'>
            {currentPost.proposalOptions.map((option, index) => (
              <div className='flex items-center gap-2 relative' key={index}>
                {/* Replace emoji dropdown with Select */}
                <Select
                  value={option.emoji || 'no_emoji'}
                  onValueChange={(emoji) => {
                    setCurrentPost(prev => {
                      const newOptions = [...(prev.proposalOptions || [])]
                      newOptions[index] = {
                        ...newOptions[index],
                        emoji: emoji === 'no_emoji' ? '' : emoji
                      }
                      return { ...prev, proposalOptions: newOptions }
                    })
                  }}
                >
                  <SelectTrigger className='w-fit p-2 border-2 border-foreground/30 rounded-md'>
                    <SelectValue placeholder={t('Emoji')}>
                      <span className='text-base p-[3px] whitespace-nowrap'>
                        {option.emoji || t('Emoji')}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='no_emoji'>{t('No emoji')}</SelectItem>
                    {emojiOptions.filter(emoji => emoji !== '').map((emoji, i) => (
                      <SelectItem key={i} value={emoji}>
                        {emoji}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type='text'
                  className='w-full rounded-md bg-midground p-2 text-foreground placeholder:text-foreground/50'
                  placeholder={t('Describe option')}
                  value={option.text}
                  onChange={(evt) => {
                    const value = evt.target.value
                    setCurrentPost(prev => {
                      const newOptions = [...(prev.proposalOptions || [])]
                      newOptions[index] = {
                        ...newOptions[index],
                        text: value
                      }
                      return { ...prev, proposalOptions: newOptions }
                    })
                  }}
                  disabled={loading}
                />
                <div
                  className='p-2 hover:cursor-pointer hover:scale-125 transition-all'
                  onClick={() => {
                    setCurrentPost(prev => {
                      const newOptions = (prev.proposalOptions || []).filter(element => {
                        if (option.id) return element.id !== option.id
                        return element.tempId !== option.tempId
                      })
                      return { ...prev, proposalOptions: newOptions }
                    })
                  }}
                >
                  <X className='w-4 h-4 text-foreground' />
                </div>
              </div>
            ))}
            <div className='border-2 border-foreground/30 rounded-md p-2 flex items-center gap-2 cursor-pointer' onClick={() => handleAddOption()}>
              <Icon name='Plus' className='text-foreground' />
              <span className='rounded-md'>{t('Add an option to vote on...')}</span>
            </div>
            {isEditing && currentPost && !isEqual(currentPost.proposalOptions, initialPost.proposalOptions) && (
              <div className='text-accent text-xs flex items-center gap-2'>
                <TriangleAlert className='h-5 w-5' />
                <span>{t('When options are changed, existing votes will be discarded')}</span>
              </div>
            )}
            {currentPost.proposalOptions.length === 0 && (
              <div className='flex items-center gap-2 text-foreground/50 text-xs'>
                <TriangleAlert className='h-5 w-5' />
                <span>{t('Proposals require at least one option')}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {currentPost.type === 'proposal' && (
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2'>
          <div className='text-xs text-foreground/50'>{t('Voting method')}</div>

          <div>
            <Select
              value={currentPost.votingMethod}
              onValueChange={handleSetProposalType}
            >
              <SelectTrigger className='w-fit border-2 bg-transparent border-foreground/30 rounded-md p-2 text-base'>
                <SelectValue>
                  <span className='text-foreground'>
                    {currentPost.votingMethod === VOTING_METHOD_SINGLE ? t('Single vote per person') : t('Multiple votes allowed')}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={VOTING_METHOD_SINGLE}>{t('Single vote per person')}</SelectItem>
                <SelectItem value={VOTING_METHOD_MULTI_UNRESTRICTED}>{t('Multiple votes allowed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {currentPost.type === 'proposal' && (
        <div className='border-2 border-transparent transition-all flex items-center gap-2 bg-input rounded-md p-2'>
          <div className='text-xs text-foreground/50 w-[100px]'>{t('Quorum')} <Icon name='Info' className='text-xs' data-tip={t('quorumExplainer')} data-tip-for='quorum-tt' /></div>
          <SliderInput percentage={currentPost.quorum || 0} setPercentage={handleSetQuorum} />
          <ReactTooltip
            backgroundColor='rgba(35, 65, 91, 1.0)'
            effect='solid'
            delayShow={0}
            id='quorum-tt'
          />
        </div>
      )}
      {currentPost.type === 'proposal' && (
        <AnonymousVoteToggle
          isAnonymousVote={!!currentPost.isAnonymousVote}
          toggleAnonymousVote={toggleAnonymousVote}
        />
      )}
      {/* {isProposal && (
        <StrictProposalToggle
          isStrictProposal={!!currentPost.isStrictProposal}
          toggleStrictProposal={toggleStrictProposal}
        />
      )} */}
      {canHaveTimes && (
        <>
          <div className='flex flex-wrap items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 min-w-0'>
            <div className='text-xs text-foreground/50 shrink-0'>{currentPost.type === 'proposal' ? t('Voting window') : t('Timeframe')}</div>
            <div className='flex flex-1 flex-wrap items-center gap-1 min-w-0'>
              <DateTimePicker
                hourCycle={hourCycle}
                granularity='minute'
                value={startTimePickerValue}
                placeholder={t('Select Start')}
                onChange={handleStartTimeChange}
                onMonthChange={() => {}}
              />
              <div className='text-xs text-foreground/50 shrink-0'>{t('to')}</div>
              <DateTimePicker
                ref={endTimeRef}
                hourCycle={hourCycle}
                granularity='minute'
                value={endTimePickerValue}
                placeholder={t('Select End')}
                onChange={handleEndTimeChange}
                onMonthChange={() => {}}
              />
            </div>
          </div>
          <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md py-0 px-2 gap-2'>
            <div className='text-xs text-foreground/50 shrink-0'>{t('Timezone')}</div>
            <TimezoneSelect
              className='border-none bg-transparent'
              value={eventTimezone}
              onChange={handleTimezoneChange}
              disabled={loading}
            />
          </div>
        </>
      )}
      {canHaveTimes && dateError && (
        <span className='text-white bg-destructive w-full ml-[10px] pb-[2px] px-[10px] rounded-[7px]'>
          {t('End Time must be after Start Time')}
        </span>
      )}
      {isAction && (
        <CompletionActionSection
          currentPost={currentPost}
          loading={loading}
          setCurrentPost={setCurrentPost}
        />
      )}
      {showLocation && (
        <div className={cn('flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2')}>
          <div className='text-xs text-foreground/50'>{locationLabel}</div>
          <LocationInput
            saveLocationToDB
            inputPosition='top'
            locationObject={currentPost.locationObject}
            location={postLocation}
            onChange={handleLocationChange}
            placeholder={locationPrompt}
            className='w-full outline-none border-none bg-transparent placeholder:text-foreground/50'
          />
        </div>
      )}
      {currentPost.type === 'event' && (
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2'>
          <div className={cn('text-xs text-foreground/50 w-[100px]', { 'text-destructive': !!currentPost.meetingLink && !sanitizeURL(currentPost.meetingLink) })}>{t('Join link')}</div>
          <input
            type='text'
            className='w-full outline-none border-none bg-transparent placeholder:text-foreground/50'
            placeholder={t('Add a video call link (Zoom, Meet, Jitsi, etc.)')}
            value={currentPost.meetingLink || ''}
            onChange={handleMeetingLinkChange}
            ref={meetingLinkInputRef}
            disabled={loading}
          />
        </div>
      )}
      {currentPost.type === 'event' && (
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2'>
          <div className='text-xs text-foreground/50 w-[100px]'>{t('Invite People')}</div>
          <div className='w-full'>
            <MemberSelector
              initialMembers={currentPost.eventInvitations || []}
              onChange={handleUpdateEventInvitations}
              forGroups={currentPost.groups}
              readOnly={loading}
              className='w-full outline-none border-none bg-transparent placeholder:text-foreground/50'
            />
          </div>
        </div>
      )}
      {currentPost.type === 'project' && currentUser.hasFeature(PROJECT_CONTRIBUTIONS) && (
        <div className='flex items-center border-2 border-transparent transition-all'>
          <div className='text-sm text-foreground/80 whitespace-nowrap mr-4'>{t('Accept Contributions')}</div>
          {hasStripeAccount && (
            <div className='w-full flex items-center'>
              <Switch
                value={currentPost.acceptContributions}
                onClick={handleToggleContributions}
                className='mr-[55px]'
              />
              {!currentPost.acceptContributions && (
                <div className='text-[13px] leading-[19px] text-foreground/60'>
                  {t('If you turn Accept Contributions on, people will be able to send money to your Stripe connected account to support this project.')}
                </div>
              )}
            </div>
          )}
          {!hasStripeAccount && (
            <div className='w-full text-[13px] leading-[19px] text-foreground/60'>
              {t(`To accept financial contributions for this project, you have
              to connect a Stripe account. Go to`)}
              <a href='/settings/payment'>{t('Settings')}</a>{' '}{t('to set it up.')}
              {t('(Remember to save your changes before leaving this form)')}
            </div>
          )}
        </div>
      )}
      {currentPost.type === 'project' && (
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2'>
          <div className={cn('text-xs text-foreground/50 w-[100px]', { 'text-destructive': !!currentPost.donationsLink && !sanitizeURL(currentPost.donationsLink) })}>{t('Donation Link')}</div>
          <div className='w-full'>
            <input
              type='text'
              className='w-full outline-none border-none bg-transparent placeholder:text-foreground/50'
              placeholder={t('Add a donation link (must be valid URL)')}
              value={currentPost.donationsLink || ''}
              onChange={handleDonationsLinkChange}
              disabled={loading}
            />
          </div>
        </div>
      )}
      {currentPost.type === 'project' && (
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2'>
          <div className={cn('text-xs text-foreground/50 w-[160px]', { 'text-destructive': !!currentPost.projectManagementLink && !sanitizeURL(currentPost.projectManagementLink) })}>{t('Project Management')}</div>
          <div className='w-full'>
            <input
              type='text'
              className='w-full outline-none border-none bg-transparent placeholder:text-foreground/50'
              placeholder={t('Add a project management link (must be valid URL)')}
              value={currentPost.projectManagementLink || ''}
              onChange={handleProjectManagementLinkChange}
              disabled={loading}
            />
          </div>
        </div>
      )}
      {(currentPost.type === 'project' || currentPost.type === 'submission') && (
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2'>
          <div className='text-xs text-foreground/50 mr-2 whitespace-nowrap'>
            {t('Budget Total')}{currentPost.type === 'submission' && currentFundingRound?.requireBudget ? '*' : ''}
          </div>
          <div className='w-full'>
            <input
              type='text'
              className='w-full outline-none border-none bg-transparent placeholder:text-foreground/50'
              value={currentPost.budget || ''}
              onChange={handleBudgetChange}
              disabled={loading}
            />
          </div>
        </div>
      )}
      <ActionsBar
        id={currentPost.id}
        addAttachment={addAttachment}
        announcementSelected={announcementSelected}
        canMakeAnnouncement={canMakeAnnouncement()}
        groupCount={get('groups', currentPost).length}
        groups={currentPost.groups}
        invalidMessage={invalidMessage}
        isEditing={isEditing}
        loading={loading}
        submitting={postPending}
        myAdminGroups={myAdminGroups}
        doSave={doSave}
        save={save}
        setAnnouncementSelected={setAnnouncementSelected}
        setIsDirty={setIsDirty}
        setShowLocation={setShowLocation}
        showAnnouncementModal={showAnnouncementModal}
        showFiles={showFiles}
        showImages={showImages}
        showLocation={showLocation}
        submitButtonLabel={buttonLabel()}
        toggleAnnouncementModal={toggleAnnouncementModal}
        type={currentPost.type}
        valid={isValid}
      />
      <Dialog open={!!typeSwitchDialog} onOpenChange={(open) => !open && handleKeepCurrentTypeContent()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Load saved {{type}} draft?', { type: typeSwitchDialog?.targetType ? t(typeSwitchDialog?.targetType) : t('post') })}</DialogTitle>
            <DialogDescription>
              {t('You already have a saved draft for this post type. Keep what you are currently writing, or replace it with the saved draft.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type='button'
              className='rounded-lg px-4 py-2 text-sm border border-foreground/20 hover:bg-foreground/10 transition-colors'
              onClick={handleKeepCurrentTypeContent}
            >
              {t('Keep what I am writing')}
            </button>
            <button
              type='button'
              className='rounded-lg px-4 py-2 text-sm font-medium text-white bg-destructive hover:bg-destructive/80 transition-colors'
              onClick={handleLoadSavedTypeDraft}
            >
              {t('Load saved draft')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CompletionActionSection ({ currentPost, loading, setCurrentPost }) {
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const effectiveGroupSlug = useEffectiveGroupSlug()
  const group = useSelector(state => getGroupForSlug(state, effectiveGroupSlug || routeParams.groupSlug))
  const currentTrack = group?.track || null

  const { completionAction, completionActionSettings } = currentPost

  const handleCompletionActionChange = useCallback((value) => {
    setCurrentPost(prev => {
      const nextSettings = {
        instructions: t('postCompletionActions.' + value + '.instructions', { actionDescriptor: currentTrack?.actionDescriptor })
      }
      if (value === 'selectMultiple' || value === 'selectOne') {
        nextSettings.options = []
      }
      return { ...prev, completionAction: value, completionActionSettings: nextSettings }
    })
  }, [currentTrack?.actionDescriptor, setCurrentPost, t])

  const handleAddOption = useCallback(() => {
    setCurrentPost(prev => {
      const options = [...(prev.completionActionSettings?.options || []), '']
      return {
        ...prev,
        completionActionSettings: {
          ...(prev.completionActionSettings || {}),
          options
        }
      }
    })
  }, [setCurrentPost])

  const handleInstructionsChange = useCallback((evt) => {
    const value = evt.target.value
    setCurrentPost(prev => ({
      ...prev,
      completionActionSettings: {
        ...(prev.completionActionSettings || {}),
        instructions: value
      }
    }))
  }, [setCurrentPost])

  return (
    <div className='flex flex-col items-start border-2 border-dashed border-foreground/30 transition-all bg-background rounded-md p-3 mt-4 mb-2 gap-2'>
      <div>{t('How can people complete this {{actionDescriptor}}?', { actionDescriptor: currentTrack?.actionDescriptor })}</div>
      <div className='w-full mb-2'>
        <Select value={completionAction} onValueChange={handleCompletionActionChange}>
          <SelectTrigger className={cn('w-fit py-1 h-8 border-2')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POST_COMPLETION_ACTIONS.map((type) => (
              <SelectItem key={type} value={type}>{t('postCompletionActions.' + type)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className='w-full p-2 bg-darkening/20 rounded-md'>
        <label className='inline-block mb-2'>{t('Completion Instructions for Members')}</label>
        <textarea
          className='w-full outline-none border-none bg-input rounded-md p-2 placeholder:text-foreground/50'
          placeholder={t('Add instructions for completing this {{actionDescriptor}}', { actionDescriptor: currentTrack?.actionDescriptor })}
          value={completionActionSettings?.instructions}
          onChange={handleInstructionsChange}
        />
        {(completionAction === 'selectMultiple' || completionAction === 'selectOne') && (
          <div className='w-full flex flex-col gap-2'>
            {completionActionSettings?.options?.map((option, index) => (
              <div className='flex flex-row gap-2 items-center bg-input rounded-md p-2' key={index}>
                <label className='whitespace-nowrap font-normal'>{t('Option {{index}}', { index: index + 1 })}</label>
                <input
                  type='text'
                  className='w-full outline-none border-none bg-transparent placeholder:text-foreground/50'
                  placeholder={t('Add description')}
                  value={option}
                  onChange={(evt) => {
                    const value = evt.target.value
                    setCurrentPost(prev => {
                      const options = [...(prev.completionActionSettings?.options || [])]
                      options[index] = value
                      return {
                        ...prev,
                        completionActionSettings: {
                          ...(prev.completionActionSettings || {}),
                          options
                        }
                      }
                    })
                  }}
                  disabled={loading}
                />
                <Icon
                  name='Ex'
                  onClick={() => {
                    setCurrentPost(prev => {
                      const options = (prev.completionActionSettings?.options || []).filter(element => element !== option)
                      return {
                        ...prev,
                        completionActionSettings: {
                          ...(prev.completionActionSettings || {}),
                          options
                        }
                      }
                    })
                  }}
                />
              </div>
            ))}
            <div className='w-full flex flex-row gap-2 items-center border-2 border-foreground/30 rounded-md p-2' onClick={() => handleAddOption()}>
              <Icon name='Plus' className='text-foreground' />
              <span>{t('Add an option')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default forwardRef(PostEditorInner)
