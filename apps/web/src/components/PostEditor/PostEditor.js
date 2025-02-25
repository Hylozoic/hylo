import { cn } from 'util/index'
import { debounce, get, isEqual, isEmpty, uniqBy, uniqueId } from 'lodash/fp'
import { DateTime } from 'luxon'
import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
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
import LinkPreview from './LinkPreview'
import { DateTimePicker } from 'components/ui/datetimepicker'
import PublicToggle from 'components/PublicToggle'
import AnonymousVoteToggle from './AnonymousVoteToggle/AnonymousVoteToggle'
import SliderInput from 'components/SliderInput/SliderInput'
import Dropdown from 'components/Dropdown/Dropdown'
import { PROJECT_CONTRIBUTIONS } from 'config/featureFlags'
import useEventCallback from 'hooks/useEventCallback'
import fetchMyMemberships from 'store/actions/fetchMyMemberships'
import {
  PROPOSAL_ADVICE,
  PROPOSAL_CONSENSUS,
  PROPOSAL_CONSENT,
  PROPOSAL_GRADIENT,
  PROPOSAL_MULTIPLE_CHOICE,
  PROPOSAL_POLL_SINGLE,
  PROPOSAL_TEMPLATES,
  POST_TYPES_SHOW_LOCATION_BY_DEFAULT,
  VOTING_METHOD_MULTI_UNRESTRICTED,
  VOTING_METHOD_SINGLE,
  PROPOSAL_YESNO
} from 'store/models/Post'
import isPendingFor from 'store/selectors/isPendingFor'
import getMe from 'store/selectors/getMe'
import getPost from 'store/selectors/getPost'
import presentPost from 'store/presenters/presentPost'
import getTopicForCurrentRoute from 'store/selectors/getTopicForCurrentRoute'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { fetchLocation, ensureLocationIdIfCoordinate } from 'components/LocationInput/LocationInput.store'
import {
  CREATE_POST,
  CREATE_PROJECT,
  FETCH_POST,
  RESP_ADMINISTRATION
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
import { setQuerystringParam } from 'util/navigation'
import { sanitizeURL } from 'util/url'
import ActionsBar from './ActionsBar'

import styles from './PostEditor.module.scss'

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

function PostEditor ({
  context,
  modal = true,
  post: propsPost,
  editing = false,
  setIsDirty = () => {},
  onCancel,
  onSave,
  afterSave,
  selectedLocation
}) {
  const dispatch = useDispatch()
  const urlLocation = useLocation()
  const routeParams = useParams()
  const navigate = useNavigate()
  const hourCycle = getHourCycle()
  const { t } = useTranslation()

  const currentUser = useSelector(getMe)
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))

  const editingPostId = routeParams.postId
  const fromPostId = getQuerystringParam('fromPostId', urlLocation)

  const postType = getQuerystringParam('newPostType', urlLocation)
  const topicName = routeParams.topicName
  const topic = useSelector(state => getTopicForCurrentRoute(state, topicName))

  const linkPreview = useSelector(state => getLinkPreview(state)) // TODO: probably not working?
  const fetchLinkPreviewPending = useSelector(state => isPendingFor(FETCH_LINK_PREVIEW, state))
  const uploadAttachmentPending = useSelector(getUploadAttachmentPending)

  const attachmentPostId = (editingPostId || fromPostId)
  const uploadFileAttachmentPending = useSelector(state => getUploadAttachmentPending(state, { type: 'post', id: attachmentPostId, attachmentType: 'file' }))
  const uploadImageAttachmentPending = useSelector(state => getUploadAttachmentPending(state, { type: 'post', id: attachmentPostId, attachmentType: 'image' }))
  const imageAttachments = useSelector(state => getAttachments(state, { type: 'post', id: attachmentPostId, attachmentType: 'image' }), (a, b) => a.length === b.length && a.every((item, index) => item.id === b[index].id))
  const fileAttachments = useSelector(state => getAttachments(state, { type: 'post', id: attachmentPostId, attachmentType: 'file' }), (a, b) => a.length === b.length && a.every((item, index) => item.id === b[index].id))
  const postPending = useSelector(state => isPendingFor([CREATE_POST, CREATE_PROJECT], state))
  const loading = useSelector(state => isPendingFor(FETCH_POST, state)) || !!uploadAttachmentPending || postPending

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

  const initialPost = useMemo(() => ({
    title: '',
    details: '',
    type: postType || (modal ? 'discussion' : 'chat'),
    groups: currentGroup ? [currentGroup] : [],
    topics: topic ? [topic] : [],
    acceptContributions: false,
    isPublic: context === 'public',
    locationId: null,
    location: '',
    timezone: DateTime.now().zoneName,
    proposalOptions: [],
    isAnonymousVote: false,
    isStrictProposal: false,
    votingMethod: VOTING_METHOD_SINGLE,
    quorum: 0,
    ...(inputPost || {}),
    startTime: typeof inputPost?.startTime === 'string' ? new Date(inputPost.startTime) : inputPost?.startTime,
    endTime: typeof inputPost?.endTime === 'string' ? new Date(inputPost.endTime) : inputPost?.endTime
  }), [inputPost?.id, postType, currentGroup, topic, context])

  const [currentPost, setCurrentPost] = useState(initialPost)
  const [invalidMessage, setInvalidMessage] = useState('')
  const [hasDescription, setHasDescription] = useState(false) // TODO: an optimization to not run isValid no every character changed in the description
  const [announcementSelected, setAnnouncementSelected] = useState(false)
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [titleLengthError, setTitleLengthError] = useState(initialPost.title?.length >= MAX_TITLE_LENGTH)
  const [dateError, setDateError] = useState(false)
  const [showLocation, setShowLocation] = useState(POST_TYPES_SHOW_LOCATION_BY_DEFAULT.includes(initialPost.type) || selectedLocation)

  const groupOptions = useMemo(() => {
    return currentUser ? currentUser.memberships.toModelArray().map((m) => m.group).sort((a, b) => a.name.localeCompare(b.name)) : []
  }, [currentUser?.memberships])

  const myAdminGroups = useSelector(state => getMyAdminGroups(state, groupOptions))

  // XXX: this is a hack because using currentPost.groups directly the group doesn't have the chatRooms attached to it
  // hoping its easier to fix with URQL :)
  const selectedGroups = useMemo(() => {
    return groupOptions.filter((g) => currentPost.groups.some((g2) => g2.id === g.id))
  }, [currentPost.groups, groupOptions])

  const toOptions = useMemo(() => {
    return groupOptions.map((g) => {
      return [{ id: 'group_' + g.id, name: g.name, avatarUrl: g.avatarUrl, group: g }]
        .concat(g.chatRooms.toModelArray()
          .map((cr) => ({ id: cr.groupTopic.id, group: g, name: g.name + ' #' + cr.groupTopic.topic.name, topic: cr.groupTopic.topic, avatarUrl: g.avatarUrl }))
          .sort((a, b) => a.name.localeCompare(b.name)))
    }).flat().flat()
  }, [groupOptions])

  const selectedToOptions = useMemo(() => {
    return selectedGroups.map((g) => {
      return [{ id: 'group_' + g.id, name: g.name, avatarUrl: g.avatarUrl, group: g }]
        .concat(g.chatRooms.toModelArray()
          .filter(cr => currentPost.topics.some(t => t.id === cr.groupTopic?.topic?.id))
          .map((cr) => ({ id: cr.groupTopic.id, group: g, name: g.name + ' #' + cr.groupTopic.topic.name, topic: cr.groupTopic.topic, avatarUrl: g.avatarUrl }))
        )
    }).flat().flat()
  }, [selectedGroups, currentPost.groups, currentPost.topics])

  useEffect(() => {
    if (isChat) {
      setTimeout(() => { editorRef.current && editorRef.current.focus() }, 100)
    } else {
      setTimeout(() => { titleInputRef.current && titleInputRef.current.focus() }, 100)
    }
    dispatch(fetchMyMemberships())
    return () => {
      dispatch(clearLinkPreview())
      dispatch(clearAttachments('post', 'new', 'image'))
    }
  }, [])

  useEffect(() => {
    setShowLocation(POST_TYPES_SHOW_LOCATION_BY_DEFAULT.includes(initialPost.type) || selectedLocation)
  }, [initialPost.type])

  useEffect(() => {
    reset()
  }, [initialPost.id])

  useEffect(() => {
    setCurrentPost({ ...currentPost, linkPreview })
  }, [linkPreview])

  useEffect(() => {
    // XXX: to make sure the topic gets included in the selectedToOptions once its loaded
    // TODO: we may want to just make sure all the necessary stuff is loaded from the server before we display the editor
    if (!topic || currentPost.topics.some(t => t.id === topic.id)) return
    setCurrentPost({ ...currentPost, topics: [...currentPost.topics, topic] })
  }, [topic])

  const reset = useCallback(() => {
    editorRef.current?.setContent(initialPost.details)
    dispatch(clearLinkPreview())
    dispatch(clearAttachments('post', 'new', 'image'))
    setCurrentPost(initialPost)
    setShowLocation(POST_TYPES_SHOW_LOCATION_BY_DEFAULT.includes(initialPost.type) || selectedLocation)
    setAnnouncementSelected(false)
    setShowAnnouncementModal(false)
    if (isChat) {
      setTimeout(() => { editorRef.current && editorRef.current.focus() }, 100)
    } else {
      toFieldRef.current.reset()
      setTimeout(() => { titleInputRef.current && titleInputRef.current.focus() }, 100)
    }
  }, [initialPost])

  const calcEndTime = useCallback((startTime) => {
    let msDiff = 3600000 // ms in one hour
    if (currentPost.startTime && currentPost.endTime) {
      const start = DateTime.fromJSDate(currentPost.startTime)
      const end = DateTime.fromJSDate(currentPost.endTime)
      msDiff = end.diff(start)
    }
    return DateTime.fromJSDate(startTime).plus({ milliseconds: msDiff }).toJSDate()
  }, [currentPost.startTime, currentPost.endTime])

  const handlePostTypeSelection = useCallback((type) => {
    setIsDirty(true)

    if (modal) {
      // Track the post type in the URL. So you can share the url with others. And maybe some other reason I'm forgetting right now
      navigate({
        pathname: urlLocation.pathname,
        search: setQuerystringParam('newPostType', type, urlLocation)
      }, { replace: true })
    }

    setCurrentPost({ ...currentPost, type })
    if (type === 'chat') {
      setTimeout(() => { editorRef.current && editorRef.current.focus() }, 100)
    } else {
      setTimeout(() => { titleInputRef.current && titleInputRef.current.focus() }, 100)
    }
  }, [currentPost, urlLocation])

  const handleTitleChange = useCallback((event) => {
    const title = event.target.value
    if (title !== currentPost.title) {
      title.length >= MAX_TITLE_LENGTH
        ? setTitleLengthError(true)
        : setTitleLengthError(false)
      setIsDirty(true)
      setCurrentPost({ ...currentPost, title })
    }
  }, [currentPost])

  const handleDetailsChange = useCallback((event) => {
    const details = editorRef.current.getText()
    setHasDescription(details.length > 0)
    setIsDirty(true)
  }, [currentPost])

  const handleToggleContributions = useCallback(() => {
    setCurrentPost({ ...currentPost, acceptContributions: !currentPost.acceptContributions })
  }, [currentPost])

  const handleStartTimeChange = (startTime) => {
    // force endTime to track startTime
    const endTime = calcEndTime(startTime)
    validateTimeChange(startTime, endTime)
    setCurrentPost({ ...currentPost, startTime, endTime })
    endTimeRef.current.setValue(endTime)
  }

  const handleEndTimeChange = useCallback((endTime) => {
    validateTimeChange(currentPost.startTime, endTime)
    setCurrentPost({ ...currentPost, endTime })
  }, [currentPost])

  const handleDonationsLinkChange = useCallback((evt) => {
    const donationsLink = evt.target.value
    setCurrentPost({ ...currentPost, donationsLink })
  }, [currentPost])

  const handleProjectManagementLinkChange = useCallback((evt) => {
    const projectManagementLink = evt.target.value
    setCurrentPost({ ...currentPost, projectManagementLink })
  }, [currentPost])

  const validateTimeChange = useCallback((startTime, endTime) => {
    if (endTime) {
      startTime < endTime
        ? setDateError(false)
        : setDateError(true)
    }
  }, [])

  const handleLocationChange = useCallback((locationObject) => {
    setCurrentPost({
      ...currentPost,
      location: locationObject.fullText,
      locationId: locationObject.id
    })
  }, [currentPost])

  // Checks for linkPreview every 1/2 second
  const handleAddLinkPreview = debounce(500, (url, force) => {
    const { linkPreview } = currentPost
    if (linkPreview && !force) return
    pollingFetchLinkPreview(dispatch, url)
  })

  const handleAddTopic = useCallback((topic) => {
    const { topics } = currentPost

    if (topics?.length >= MAX_POST_TOPICS) return
    setCurrentPost({ ...currentPost, topics: [...topics, topic] })
    setIsDirty(true)
  }, [currentPost])

  const handleFeatureLinkPreview = useCallback(featured => {
    setCurrentPost({ ...currentPost, linkPreviewFeatured: featured })
  }, [currentPost])

  const handleRemoveLinkPreview = useCallback(() => {
    dispatch(removeLinkPreview())
    setCurrentPost({ ...currentPost, linkPreview: null, linkPreviewFeatured: false })
  }, [currentPost])

  const handleAddToOption = useCallback((toOptions) => {
    const groups = uniqBy('id', toOptions.map(toOption => toOption.group))
    const topics = uniqBy('id', toOptions.filter(toOption => toOption.topic).map(toOption => toOption.topic))
    const hasChanged = !isEqual(initialPost.groups, groups) || !isEqual(initialPost.topics, topics)

    setCurrentPost({ ...currentPost, groups, topics })

    if (hasChanged) {
      setIsDirty(true)
    }
  }, [currentPost])

  const togglePublic = useCallback(() => {
    const { isPublic } = currentPost
    setCurrentPost({ ...currentPost, isPublic: !isPublic })
  }, [currentPost])

  const toggleAnonymousVote = useCallback(() => {
    const { isAnonymousVote } = currentPost
    setCurrentPost({ ...currentPost, isAnonymousVote: !isAnonymousVote })
  }, [currentPost])

  // const toggleStrictProposal = () => {
  //   const { isStrictProposal } = currentPost
  //   setCurrentPost({ ...currentPost, isStrictProposal: !isStrictProposal })
  // }

  const handleUpdateProjectMembers = useCallback((members) => {
    setCurrentPost({ ...currentPost, members })
  }, [currentPost])

  const handleUpdateEventInvitations = useCallback((eventInvitations) => {
    setCurrentPost({ ...currentPost, eventInvitations })
  }, [currentPost])

  const isValid = useMemo(() => {
    const { type, title, groups, startTime, endTime, donationsLink, projectManagementLink, proposalOptions } = currentPost

    const errorMessages = []

    switch (type) {
      case 'event':
        if (!endTime || !startTime || startTime >= endTime) {
          errorMessages.push(t('Valid start and end time required'))
        }
        break
      case 'project':
        if (!donationsLink || !sanitizeURL(donationsLink) || !projectManagementLink || !sanitizeURL(projectManagementLink)) {
          errorMessages.push(t('Donations and project management links must be valid URLs'))
        }
        break
      case 'proposal':
        if (proposalOptions?.length === 0) {
          errorMessages.push(t('At least one proposal option required'))
        }
        break
    }

    if (type === 'chat') {
      if (!hasDescription) {
        errorMessages.push(t('Chat must have content'))
      }
    } else {
      if (title?.length === 0 || title?.length > MAX_TITLE_LENGTH) {
        errorMessages.push(t('Title is required'))
      }
    }

    if (groups?.length === 0) {
      errorMessages.push(t('At least one group required'))
    }

    if (errorMessages.length > 0) {
      setInvalidMessage(errorMessages.join('<br />'))
    }

    return errorMessages.length === 0
  }, [hasDescription, currentPost.type, currentPost.title, currentPost.groups, currentPost.startTime, currentPost.endTime, currentPost.donationsLink, currentPost.projectManagementLink, currentPost.proposalOptions])

  // const handleCancel = () => {
  //   if (onCancel) {
  //     onCancel()
  //     return true
  //   }
  // }

  const save = useCallback(async () => {
    const {
      acceptContributions,
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
    const memberIds = members && members.map((m) => m.id)
    const eventInviteeIds =
      eventInvitations && eventInvitations.map((m) => m.id)
    const imageUrls =
      imageAttachments && imageAttachments.map((attachment) => attachment.url)
    const fileUrls =
      fileAttachments && fileAttachments.map((attachment) => attachment.url)
    const postLocation = currentPost.location || selectedLocation
    const actualLocationId = await ensureLocationIdIfCoordinate({
      fetchLocation,
      postLocation,
      locationId
    })

    const postToSave = {
      id,
      acceptContributions,
      commenters: [], // For optimistic display of the new post
      createdAt: DateTime.now().toISO(), // For optimistic display of the new post
      creator: currentUser, // For optimistic display of the new post
      details,
      donationsLink: sanitizeURL(donationsLink),
      endTime,
      eventInviteeIds,
      fileAttachments, // For optimistic display of the new post
      fileUrls,
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
      type
    }

    const saveFunc = isEditing ? updatePost : createPost
    setAnnouncementSelected(false)
    if (onSave) onSave(postToSave)
    const savedPost = await dispatch(saveFunc(postToSave))
    if (afterSave) afterSave(savedPost.payload.data.createPost)
    reset()
  }, [afterSave, announcementSelected, currentPost, fileAttachments, imageAttachments, isEditing, onSave, selectedLocation])

  const doSave = useEventCallback(() => {
    if (!isValid || loading) return

    const _save = announcementSelected ? toggleAnnouncementModal : save
    if (currentPost.type === 'proposal' && isEditing && !isEqual(currentPost.proposalOptions, initialPost.proposalOptions)) {
      if (window.confirm(t('Changing proposal options will reset the votes. Are you sure you want to continue?'))) {
        _save()
      }
    } else {
      _save()
    }
  }, [announcementSelected, currentPost.type, currentPost.proposalOptions, isEditing, isValid, initialPost.proposalOptions, save, loading])

  const buttonLabel = useCallback(() => {
    if (postPending) return t('Posting...')
    if (isEditing) return t('Save')
    return t('Post')
  }, [postPending, isEditing])

  const toggleAnnouncementModal = useCallback(() => {
    setShowAnnouncementModal(!showAnnouncementModal)
  }, [showAnnouncementModal])

  const handleSetQuorum = useCallback((quorum) => {
    setCurrentPost({ ...currentPost, quorum })
  }, [currentPost])

  const handleSetProposalType = useCallback((votingMethod) => {
    setCurrentPost({ ...currentPost, votingMethod })
  }, [currentPost])

  const handleUseTemplate = useCallback((template) => {
    const templateData = PROPOSAL_TEMPLATES[template]
    setCurrentPost({
      ...currentPost,
      proposalOptions: templateData.form.proposalOptions.map(option => { return { ...option, tempId: generateTempID() } }),
      title: currentPost.title.length > 0 ? currentPost.title : templateData.form.title,
      quorum: templateData.form.quorum,
      votingMethod: templateData.form.votingMethod
    })
  }, [currentPost])

  const handleAddOption = useCallback(() => {
    const { proposalOptions } = currentPost
    const newOptions = [...proposalOptions, { text: '', emoji: '', color: '', tempId: generateTempID() }]
    setCurrentPost({ ...currentPost, proposalOptions: newOptions })
  }, [currentPost])

  const canMakeAnnouncement = useCallback(() => {
    const { groups = [] } = currentPost
    const myAdminGroupsSlugs = myAdminGroups.map(group => group.slug)
    for (let index = 0; index < groups.length; index++) {
      if (!myAdminGroupsSlugs.includes(groups[index].slug)) return false
    }
    return true
  }, [currentPost, myAdminGroups])

  const canHaveTimes = currentPost.type !== 'discussion' && currentPost.type !== 'chat'
  const postLocation = currentPost.location || selectedLocation
  const locationPrompt = currentPost.type === 'proposal' ? t('Is there a relevant location for this proposal?') : t('Where is your {{type}} located?', { type: currentPost.type })
  const hasStripeAccount = get('hasStripeAccount', currentUser)
  const isChat = currentPost.type === 'chat'

  const handleToFieldContainerClick = () => {
    toFieldRef.current?.focus() // This will call the focus method on ToField
  }

  return (
    <div className={cn('flex flex-col rounded-lg bg-background p-3 shadow-xl')}>
      <div className={cn('PostEditorHeader relative', { 'my-1 pb-2': !isChat })}>
        <PostTypeSelect
          disabled={loading}
          includeChat={!modal}
          postType={currentPost.type}
          setPostType={handlePostTypeSelection}
          className={cn({ 'absolute top-1 right-1 z-10': isChat })}
        />
      </div>
      {!isChat && (
        <div
          className={cn('PostEditorTo flex items-center border-2 border-transparent transition-all', styles.section, { 'border-2 border-focus': toFieldFocused })}
          onClick={handleToFieldContainerClick}
        >
          <div className='text-xs text-foreground/50 px-2'>{t('To')}</div>
          <div className={cn('border-foreground w-full', styles.sectionGroups)}>
            <ToField
              options={toOptions}
              selected={selectedToOptions}
              onChange={handleAddToOption}
              readOnly={loading}
              ref={toFieldRef}
              onFocus={() => setToFieldFocused(true)}
              onBlur={() => setToFieldFocused(false)}
            />
          </div>
        </div>
      )}
      {!isChat && (
        <div className={cn('PostEditorTitle transition-all border-2 border-transparent', styles.section, { 'border-2 border-focus': titleFocused })}>
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
            <span className={styles.titleError}>{t('Title limited to {{maxTitleLength}} characters', { maxTitleLength: MAX_TITLE_LENGTH })}</span>
          )}
        </div>
      )}
      <div className={cn('PostEditorContent', styles.section, 'flex flex-col !items-start')}>
        {currentPost.details === null || loading
          ? <div className={styles.editor}><Loading /></div>
          : <HyloEditor
              key={currentPost.id}
              placeholder={isChat ? t('Send a chat to #{{topicName}}', { topicName: currentPost?.topics?.[0]?.name }) : t('Add a description')}
              onUpdate={handleDetailsChange}
              onAltEnter={doSave}
              // Disable edit cancel through escape due to event bubbling issues
              // onEscape={handleCancel}
              onAddTopic={handleAddTopic}
              onAddLink={handleAddLinkPreview}
              contentHTML={currentPost.details}
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
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('Project Members')}</div>
          <div className={styles.sectionGroups}>
            <MemberSelector
              initialMembers={currentPost.members || []}
              onChange={handleUpdateProjectMembers}
              forGroups={currentPost.groups}
              readOnly={loading}
            />
          </div>
        </div>
      )}
      {/* <div className={styles.section}>
        <div className={styles.sectionLabel}>{t('Topics')}</div>
        <div className={styles.sectionTopics}>
          <TopicSelector
            forGroups={currentPost?.groups || [currentGroup]}
            selectedTopics={currentPost.topics}
            onChange={handleTopicSelectorOnChange}
          />
        </div>
      </div> */}
      {!isChat && (
        <div className={cn('PostEditorPublic', styles.section)}>
          <PublicToggle
            togglePublic={togglePublic}
            isPublic={!!currentPost.isPublic}
          />
        </div>
      )}
      {currentPost.type === 'proposal' && currentPost.proposalOptions.length === 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('Proposal template')}</div>
          <div className={styles.inputContainer}>
            <Dropdown
              className={styles.dropdown}
              toggleChildren={
                <span className={styles.dropdownLabel}>
                  {t('Select pre-set')}
                  <Icon name='ArrowDown' blue />
                </span>
              }
              items={[
                { label: t(PROPOSAL_YESNO), onClick: () => handleUseTemplate(PROPOSAL_YESNO) },
                { label: t(PROPOSAL_POLL_SINGLE), onClick: () => handleUseTemplate(PROPOSAL_POLL_SINGLE) },
                { label: t(PROPOSAL_MULTIPLE_CHOICE), onClick: () => handleUseTemplate(PROPOSAL_MULTIPLE_CHOICE) },
                { label: t(PROPOSAL_ADVICE), onClick: () => handleUseTemplate(PROPOSAL_ADVICE) },
                { label: t(PROPOSAL_CONSENT), onClick: () => handleUseTemplate(PROPOSAL_CONSENT) },
                { label: t(PROPOSAL_CONSENSUS), onClick: () => handleUseTemplate(PROPOSAL_CONSENSUS) },
                { label: t(PROPOSAL_GRADIENT), onClick: () => handleUseTemplate(PROPOSAL_GRADIENT) }
              ]}
            />
          </div>
        </div>
      )}
      {currentPost.type === 'proposal' && currentPost.proposalOptions && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            {t('Proposal options')}*
          </div>
          <div className={styles.optionsContainer}>
            {currentPost.proposalOptions.map((option, index) => (
              <div className={styles.proposalOption} key={index}>
                {/* emojiPicker dropdown */}
                <Dropdown
                  className={styles.optionDropdown}
                  toggleChildren={
                    <span className={cn(styles.optionDropdownLabel, styles.dropdownLabel)}>
                      {option.emoji || t('Emoji')}
                      <Icon name='ArrowDown' blue className={cn(styles.optionDropdownIcon, styles.blue)} />
                    </span>
                  }
                >
                  <div className={styles.emojiGrid}>
                    {emojiOptions.map((emoji, i) => (
                      <div
                        key={i}
                        className={styles.emojiOption}
                        onClick={() => {
                          const newOptions = [...currentPost.proposalOptions]
                          newOptions[index].emoji = emoji
                          setCurrentPost({ ...currentPost, proposalOptions: newOptions })
                        }}
                      >
                        {emoji}
                      </div>
                    ))}
                  </div>
                </Dropdown>
                <input
                  type='text'
                  className={styles.optionTextInput}
                  placeholder={t('Describe option')}
                  value={option.text}
                  onChange={(evt) => {
                    const newOptions = [...currentPost.proposalOptions]
                    newOptions[index].text = evt.target.value
                    setCurrentPost({ ...currentPost, proposalOptions: newOptions })
                  }}
                  disabled={loading}
                />
                <Icon
                  name='Ex'
                  className={styles.icon}
                  onClick={() => {
                    const newOptions = currentPost.proposalOptions.filter(element => {
                      if (option.id) return element.id !== option.id
                      return element.tempId !== option.tempId
                    })

                    setCurrentPost({ ...currentPost, proposalOptions: newOptions })
                  }}
                />
              </div>
            ))}
            <div className={styles.proposalOption} onClick={() => handleAddOption()}>
              <Icon name='Plus' className={styles.iconPlus} blue />
              <span className={styles.optionText}>{t('Add an option to vote on...')}</span>
            </div>
            {currentPost && !isEqual(currentPost.proposalOptions, initialPost.proposalOptions) && (
              <div className={cn(styles.proposalOption, styles.warning)} onClick={() => handleAddOption()}>
                <Icon name='Hand' className={styles.iconPlus} />
                <span className={styles.optionText}>{t('If you save changes to options, all votes will be discarded')}</span>
              </div>
            )}
            {currentPost.proposalOptions.length === 0 && (
              <div className={cn(styles.proposalOption, styles.warning)} onClick={() => handleAddOption()}>
                <Icon name='Hand' className={styles.iconPlus} />
                <span className={styles.optionText}>{t('Proposals require at least one option')}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {currentPost.type === 'proposal' && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('Voting method')}</div>

          <div className={styles.inputContainer}>
            <Dropdown
              className={styles.dropdown}
              toggleChildren={
                <span className={styles.dropdownLabel}>
                  {currentPost.votingMethod === VOTING_METHOD_SINGLE ? t('Single vote per person') : t('Multiple votes allowed')}
                  <Icon name='ArrowDown' blue />
                </span>
              }
              items={[
                { label: t('Single vote per person'), onClick: () => handleSetProposalType(VOTING_METHOD_SINGLE) },
                { label: t('Multiple votes allowed'), onClick: () => handleSetProposalType(VOTING_METHOD_MULTI_UNRESTRICTED) }
              ]}
            />
          </div>
        </div>
      )}
      {currentPost.type === 'proposal' && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('Quorum')} <Icon name='Info' className={cn(styles.quorumTooltip)} data-tip={t('quorumExplainer')} data-tip-for='quorum-tt' /></div>
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
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{currentPost.type === 'proposal' ? t('Voting window') : t('Timeframe')}</div>
          <div className={styles.datePickerModule}>
            <DateTimePicker
              hourCycle={hourCycle}
              granularity='minute'
              value={currentPost.startTime}
              placeholder={t('Select Start')}
              onChange={handleStartTimeChange}
              onMonthChange={() => {}}
            />
            <div className={styles.sectionHelper}>{t('To')}</div>
            <DateTimePicker
              ref={endTimeRef}
              hourCycle={hourCycle}
              granularity='minute'
              value={currentPost.endTime}
              placeholder={t('Select End')}
              onChange={handleEndTimeChange}
              onMonthChange={() => {}}
            />
          </div>
        </div>
      )}
      {canHaveTimes && dateError && (
        <span className={styles.datepickerError}>
          {t('End Time must be after Start Time')}
        </span>
      )}
      {showLocation && (
        <div className={styles.section}>
          <div className={cn(styles.sectionLabel, styles.alignedLabel)}>{t('Location')}</div>
          <LocationInput
            saveLocationToDB
            locationObject={currentPost.locationObject}
            location={postLocation}
            onChange={handleLocationChange}
            placeholder={locationPrompt}
          />
        </div>
      )}
      {currentPost.type === 'event' && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('Invite People')}</div>
          <div className={styles.sectionGroups}>
            <MemberSelector
              initialMembers={currentPost.eventInvitations || []}
              onChange={handleUpdateEventInvitations}
              forGroups={currentPost.groups}
              readOnly={loading}
            />
          </div>
        </div>
      )}
      {currentPost.type === 'project' && currentUser.hasFeature(PROJECT_CONTRIBUTIONS) && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('Accept Contributions')}</div>
          {hasStripeAccount && (
            <div
              className={cn(styles.sectionGroups, styles.acceptContributions)}
            >
              <Switch
                value={currentPost.acceptContributions}
                onClick={handleToggleContributions}
                className={styles.acceptContributionsSwitch}
              />
              {!currentPost.acceptContributions && (
                <div className={styles.acceptContributionsHelp}>
                  {t(`If you turn 'Accept Contributions' on, people will be able
                  to send money to your Stripe connected account to support
                  this project.`)}
                </div>
              )}
            </div>
          )}
          {!hasStripeAccount && (
            <div
              className={cn(
                styles.sectionGroups,
                styles.acceptContributionsHelp
              )}
            >
              {t(`To accept financial contributions for this project, you have
              to connect a Stripe account. Go to`)}
              <a href='/settings/payment'>{t('Settings')}</a>{' '}{t('to set it up.')}
              {t('(Remember to save your changes before leaving this form)')}
            </div>
          )}
        </div>
      )}
      {currentPost.type === 'project' && (
        <div className={styles.section}>
          <div className={cn(styles.sectionLabel, { [styles.warning]: !!currentPost.donationsLink && !sanitizeURL(currentPost.donationsLink) })}>{t('Donation Link')}</div>
          <div className={styles.sectionGroups}>
            <input
              type='text'
              className={styles.textInput}
              placeholder={t('Add a donation link (must be valid URL)')}
              value={currentPost.donationsLink || ''}
              onChange={handleDonationsLinkChange}
              disabled={loading}
            />
          </div>
        </div>
      )}
      {currentPost.type === 'project' && (
        <div className={styles.section}>
          <div className={cn(styles.sectionLabel, { [styles.warning]: !!currentPost.projectManagementLink && !sanitizeURL(currentPost.projectManagementLink) })}>{t('Project Management')}</div>
          <div className={styles.sectionGroups}>
            <input
              type='text'
              className={styles.textInput}
              placeholder={t('Add a project management link (must be valid URL)')}
              value={currentPost.projectManagementLink || ''}
              onChange={handleProjectManagementLinkChange}
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
        loading={loading}
        myAdminGroups={myAdminGroups}
        doSave={doSave}
        save={save}
        setAnnouncementSelected={setAnnouncementSelected}
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
    </div>
  )
}

export default PostEditor
