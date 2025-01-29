import { cn } from 'util/index'
import { debounce, get, isEqual, isEmpty, uniqBy } from 'lodash/fp'
import { DateTime } from 'luxon'
import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { createSelector } from 'reselect'
import AttachmentManager from 'components/AttachmentManager'
import Icon from 'components/Icon'
import LocationInput from 'components/LocationInput'
import RoundImage from 'components/RoundImage'
import HyloEditor from 'components/HyloEditor'
import Button from 'components/Button'
import Loading from 'components/Loading'
import Switch from 'components/Switch'
import ToField from 'components/ToField'
import TopicSelector from 'components/TopicSelector'
import MemberSelector from 'components/MemberSelector'
import LinkPreview from './LinkPreview'
import { DateTimePicker } from 'components/ui/datetimepicker'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import SendAnnouncementModal from 'components/SendAnnouncementModal'
import PublicToggle from 'components/PublicToggle'
import AnonymousVoteToggle from './AnonymousVoteToggle/AnonymousVoteToggle'
import SliderInput from 'components/SliderInput/SliderInput'
import Dropdown from 'components/Dropdown/Dropdown'
import Tooltip from 'components/Tooltip'
import { PROJECT_CONTRIBUTIONS } from 'config/featureFlags'
import fetchMyMemberships from 'store/actions/fetchMyMemberships'
import {
  POST_TYPES,
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
import { postUrl, setQuerystringParam } from 'util/navigation'
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
  post: propsPost,
  postTypes = Object.keys(POST_TYPES).filter(t => t !== 'chat'),
  editing = false,
  setIsDirty = () => {},
  onCancel,
  onClose,
  selectedLocation
}) {
  const dispatch = useDispatch()
  const urlLocation = useLocation()
  const routeParams = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const currentUser = useSelector(getMe)
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const groupOptions = useMemo(() => {
    return currentUser ? currentUser.memberships.toModelArray().map((m) => m.group).sort((a, b) => a.name.localeCompare(b.name)) : []
  }, [currentUser?.memberships])

  const myAdminGroups = useSelector(state => getMyAdminGroups(state, groupOptions))

  const editingPostId = routeParams.postId
  const fromPostId = getQuerystringParam('fromPostId', location)

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
    type: postType || 'discussion',
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
  const [valid, setValid] = useState(editing || !!initialPost.title)
  const [announcementSelected, setAnnouncementSelected] = useState(false)
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [showPostTypeMenu, setShowPostTypeMenu] = useState(false)
  const [titleLengthError, setTitleLengthError] = useState(initialPost.title?.length >= MAX_TITLE_LENGTH)
  const [dateError, setDateError] = useState(false)
  const [allowAddTopic, setAllowAddTopic] = useState(true)
  const [showLocation, setShowLocation] = useState(POST_TYPES_SHOW_LOCATION_BY_DEFAULT.includes(initialPost.type))

  const toOptions = useMemo(() => {
    return groupOptions.map((g) => [{ id: 'group_' + g.id, name: g.name, avatarUrl: g.avatarUrl, group: g }]
      .concat(g.chatRooms.toModelArray()
        .map((cr) => ({ id: cr.groupTopic.id, group: g, name: g.name + ' #' + cr.groupTopic.topic.name, topic: cr.groupTopic.topic, avatarUrl: g.avatarUrl }))
        .sort((a, b) => a.name.localeCompare(b.name)))
      .flat()).flat()
  }, [groupOptions])

  const selectedToOptions = useMemo(() => {
    return currentPost.groups.map((g) => [{ id: 'group_' + g.id, name: g.name, avatarUrl: g.avatarUrl, group: g }]
      .concat(g.chatRooms.toModelArray()
        .filter(cr => currentPost.topics.some(t => t.id === cr.groupTopic?.topic?.id))
        .map((cr) => ({ id: cr.groupTopic.id, group: g, name: g.name + ' #' + cr.groupTopic.topic.name, topic: cr.groupTopic.topic, avatarUrl: g.avatarUrl }))
      )
      .flat()).flat()
  }, [currentPost.groups])

  useEffect(() => {
    setTimeout(() => { titleInputRef.current && titleInputRef.current.focus() }, 100)
    dispatch(fetchMyMemberships())
    return () => {
      dispatch(clearLinkPreview())
    }
  }, [])

  useEffect(() => {
    setShowLocation(showLocation || POST_TYPES_SHOW_LOCATION_BY_DEFAULT.includes(initialPost.type))
  }, [initialPost.type])

  useEffect(() => {
    toFieldRef.current.reset()
    editorRef.current.setContent(initialPost.details)
    setCurrentPost(initialPost)
    editorRef.current.focus()
  }, [initialPost.id])

  useEffect(() => {
    setCurrentPost({ ...currentPost, linkPreview })
  }, [linkPreview])

  const calcEndTime = (startTime) => {
    let msDiff = 3600000 // ms in one hour
    if (currentPost.startTime && currentPost.endTime) {
      const start = DateTime.fromJSDate(currentPost.startTime)
      const end = DateTime.fromJSDate(currentPost.endTime)
      msDiff = end.diff(start)
    }
    return DateTime.fromJSDate(startTime).plus({ milliseconds: msDiff }).toJSDate()
  }

  const handlePostTypeSelection = (type) => (event) => {
    setIsDirty(true)
    navigate({
      pathname: urlLocation.pathname,
      search: setQuerystringParam('newPostType', type, urlLocation)
    }, { replace: true })

    setCurrentPost({ ...currentPost, type })
    setValid(isValid({ type }))
    setShowPostTypeMenu(!showPostTypeMenu)
  }

  const postTypeButtonProps = useCallback((forPostType) => {
    const { type } = currentPost
    const active = type === forPostType
    const className = cn(
      styles.postType,
      styles[`postType${forPostType.charAt(0).toUpperCase() + forPostType.slice(1)}`],
      {
        [styles.active]: active,
        [styles.selectable]: !loading && !active
      }
    )
    const label = active
      ? (
        <span className={styles.initialPrompt}>
          <span>{t(forPostType)}</span>{' '}
          <Icon className={cn('icon', `icon-${forPostType}`)} name='ArrowDown' />
        </span>
        )
      : t(forPostType)
    return {
      borderRadius: '5px',
      label,
      onClick: active ? togglePostTypeMenu : handlePostTypeSelection(forPostType),
      disabled: loading,
      color: '',
      className
    }
  }, [currentPost, loading])

  const handleTitleChange = useCallback((event) => {
    const title = event.target.value
    if (title !== currentPost.title) {
      title.length >= MAX_TITLE_LENGTH
        ? setTitleLengthError(true)
        : setTitleLengthError(false)
      setIsDirty(true)
      setCurrentPost({ ...currentPost, title })
      setValid(isValid({ title }))
    }
  }, [currentPost])

  const handleDetailsChange = useCallback(() => {
    setIsDirty(true)
  }, [])

  const handleToggleContributions = useCallback(() => {
    setCurrentPost({ ...currentPost, acceptContributions: !currentPost.acceptContributions })
  }, [currentPost])

  const handleStartTimeChange = (startTime) => {
    // force endTime to track startTime
    const endTime = calcEndTime(startTime)
    validateTimeChange(startTime, endTime)
    setCurrentPost({ ...currentPost, startTime, endTime })
    setValid(isValid({ startTime, endTime }))
    endTimeRef.current.setValue(endTime)
  }

  const handleEndTimeChange = useCallback((endTime) => {
    validateTimeChange(currentPost.startTime, endTime)
    setCurrentPost({ ...currentPost, endTime })
    setValid(isValid({ endTime }))
  }, [currentPost])

  const handleDonationsLinkChange = useCallback((evt) => {
    const donationsLink = evt.target.value
    setCurrentPost({ ...currentPost, donationsLink })
    setValid(isValid({ donationsLink }))
  }, [currentPost])

  const handleProjectManagementLinkChange = useCallback((evt) => {
    const projectManagementLink = evt.target.value
    setCurrentPost({ ...currentPost, projectManagementLink })
    setValid(isValid({ projectManagementLink }))
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
    setValid(isValid({ locationId: locationObject.id }))
  }, [currentPost])

  // Checks for linkPreview every 1/2 second
  const handleAddLinkPreview = debounce(500, (url, force) => {
    const { linkPreview } = currentPost
    if (linkPreview && !force) return
    pollingFetchLinkPreview(dispatch, url)
  })

  const handleTopicSelectorOnChange = useCallback(topics => {
    setCurrentPost({ ...currentPost, topics })
    setAllowAddTopic(false)
    setIsDirty(true)
  }, [currentPost])

  const handleAddTopic = useCallback((topic) => {
    const { topics } = currentPost

    if (!allowAddTopic || topics?.length >= MAX_POST_TOPICS) return
    setCurrentPost({ ...currentPost, topics: [...topics, topic] })
    setIsDirty(true)
  }, [currentPost, allowAddTopic])

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
    setValid(isValid({ groups, topics }))

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

  const isValid = useCallback((postUpdates = {}) => {
    const { type, title, groups, startTime, endTime, donationsLink, projectManagementLink, proposalOptions } = Object.assign(
      {},
      currentPost,
      postUpdates
    )

    let validTypeData = type?.length > 0
    switch (type) {
      case 'event':
        validTypeData = endTime && startTime && startTime < endTime
        break
      case 'project':
        validTypeData = (!donationsLink || sanitizeURL(donationsLink)) &&
          (!projectManagementLink || sanitizeURL(projectManagementLink))
        break
      case 'proposal':
        validTypeData = proposalOptions?.length > 0
        break
    }

    return !!(
      validTypeData &&
      editorRef.current &&
      groups?.length > 0 &&
      title?.length > 0 && title?.length <= MAX_TITLE_LENGTH
    )
  }, [currentPost])

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
      details,
      donationsLink: sanitizeURL(donationsLink),
      endTime,
      eventInviteeIds,
      fileUrls,
      groups,
      imageUrls,
      isAnonymousVote,
      isPublic,
      isStrictProposal,
      linkPreview,
      linkPreviewFeatured,
      location: postLocation,
      locationId: actualLocationId,
      memberIds,
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
    await dispatch(saveFunc(postToSave))
    onClose()
  }, [currentPost, isEditing, onClose])

  const doSave = useCallback(() => {
    const _save = announcementSelected ? toggleAnnouncementModal : save
    if (currentPost.type === 'proposal' && isEditing && !isEqual(currentPost.proposalOptions, initialPost.proposalOptions)) {
      if (window.confirm(t('Changing proposal options will reset the votes. Are you sure you want to continue?'))) {
        _save()
      }
    } else {
      _save()
    }
  }, [currentPost, isEditing, initialPost, save])

  const buttonLabel = useCallback(() => {
    if (postPending) return t('Posting...')
    if (isEditing) return t('Save')
    return t('Post')
  }, [postPending, isEditing])

  const toggleAnnouncementModal = useCallback(() => {
    setShowAnnouncementModal(!showAnnouncementModal)
  }, [showAnnouncementModal])

  const togglePostTypeMenu = useCallback(() => {
    setShowPostTypeMenu(!showPostTypeMenu)
  }, [showPostTypeMenu])

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
    setValid(isValid({ proposalOptions: templateData.form.proposalOptions }))
  }, [currentPost])

  const handleAddOption = useCallback(() => {
    const { proposalOptions } = currentPost
    const newOptions = [...proposalOptions, { text: '', emoji: '', color: '', tempId: generateTempID() }]
    setCurrentPost({ ...currentPost, proposalOptions: newOptions })
    setValid(isValid({ proposalOptions: newOptions }))
  }, [currentPost])

  const canMakeAnnouncement = useCallback(() => {
    const { groups = [] } = currentPost
    const myAdminGroupsSlugs = myAdminGroups.map(group => group.slug)
    for (let index = 0; index < groups.length; index++) {
      if (!myAdminGroupsSlugs.includes(groups[index].slug)) return false
    }
    return true
  }, [currentPost, myAdminGroups])

  const canHaveTimes = currentPost.type !== 'discussion'
  const postLocation = currentPost.location || selectedLocation
  const locationPrompt = currentPost.type === 'proposal' ? t('Is there a relevant location for this proposal?') : t('Where is your {{type}} located?', { type: currentPost.type })
  const hasStripeAccount = get('hasStripeAccount', currentUser)
  const invalidPostWarning = currentPost.type === 'proposal' ? t('You need a title, a group and at least one option for a proposal') : t('You need a title and at least one group to post')

  return (
    <div className={cn('flex flex-col rounded-lg border border border-border bg-popover p-3', { [styles.hide]: showAnnouncementModal })}>
      <div className='PostEditorHeader relative my-1'>
        <div>
          {currentPost.type && <Button noDefaultStyles {...postTypeButtonProps(currentPost.type)} />}
          {showPostTypeMenu && (
            <div className={styles.postTypeMenu}>
              {postTypes
                .filter((postType) => postType !== currentPost.type)
                .map((postType) => (
                  <Button noDefaultStyles {...postTypeButtonProps(postType)} key={postType} />
                ))}
            </div>
          )}
        </div>
      </div>
      <div className={cn('PostEditorTo', styles.section)}>
        <div className={styles.sectionLabel}>{t('To')}*</div>
        <div className={styles.sectionGroups}>
          <ToField
            options={toOptions}
            selected={selectedToOptions}
            onChange={handleAddToOption}
            readOnly={loading}
            ref={toFieldRef}
          />
        </div>
      </div>
      <div className={cn('PostEditorTitle', styles.section)}>
        <div className={styles.sectionLabel}>{t('Title')}*</div>
        <input
          type='text'
          className='bg-transparent focus:outline-none flex-1'
          value={currentPost.title || ''}
          onChange={handleTitleChange}
          disabled={loading}
          ref={titleInputRef}
          maxLength={MAX_TITLE_LENGTH}
        />
        {titleLengthError && (
          <span className={styles.titleError}>{t('Title limited to {{maxTitleLength}} characters', { maxTitleLength: MAX_TITLE_LENGTH })}</span>
        )}
      </div>
      <div className={cn('PostEditorContent', styles.section)}>
        {currentPost.details === null || loading
          ? <div className={styles.editor}><Loading /></div>
          : <HyloEditor
              key={currentPost.id}
              className={styles.editor}
              placeholder={t('Add a description')}
              onUpdate={handleDetailsChange}
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
      <div className={cn('PostEditorPublic', styles.section)}>
        <PublicToggle
          togglePublic={togglePublic}
          isPublic={!!currentPost.isPublic}
        />
      </div>
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
                    setValid(isValid({ proposalOptions: newOptions }))
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
              hourCycle={12}
              granularity='minute'
              value={currentPost.startTime}
              placeholder={t('Select Start')}
              onChange={handleStartTimeChange}
              onMonthChange={() => {}}
            />
            <div className={styles.sectionHelper}>{t('To')}</div>
            <DateTimePicker
              ref={endTimeRef}
              hourCycle={12}
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
        invalidPostWarning={invalidPostWarning}
        loading={loading}
        myAdminGroups={myAdminGroups}
        save={doSave}
        setAnnouncementSelected={setAnnouncementSelected}
        setShowLocation={setShowLocation}
        showAnnouncementModal={showAnnouncementModal}
        showFiles={showFiles}
        showImages={showImages}
        showLocation={showLocation}
        submitButtonLabel={buttonLabel()}
        toggleAnnouncementModal={toggleAnnouncementModal}
        valid={valid}
      />
    </div>
  )
}

export default PostEditor
