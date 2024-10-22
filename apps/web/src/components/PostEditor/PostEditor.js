import cx from 'classnames'
import { debounce, get, isEqual, isEmpty } from 'lodash/fp'
import Moment from 'moment-timezone'
import React, { useMemo, useRef, useEffect, useState } from 'react'
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
import Switch from 'components/Switch'
import GroupsSelector from 'components/GroupsSelector'
import TopicSelector from 'components/TopicSelector'
import MemberSelector from 'components/MemberSelector'
import LinkPreview from './LinkPreview'
import DatePicker from 'components/DatePicker'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import SendAnnouncementModal from 'components/SendAnnouncementModal'
import PublicToggle from 'components/PublicToggle'
import AnonymousVoteToggle from './AnonymousVoteToggle/AnonymousVoteToggle'
import SliderInput from 'components/SliderInput/SliderInput'
import Dropdown from 'components/Dropdown/Dropdown'
import Tooltip from 'components/Tooltip'
import { PROJECT_CONTRIBUTIONS } from 'config/featureFlags'
import {
  POST_TYPES,
  PROPOSAL_ADVICE,
  PROPOSAL_CONSENSUS,
  PROPOSAL_CONSENT,
  PROPOSAL_GRADIENT,
  PROPOSAL_MULTIPLE_CHOICE,
  PROPOSAL_POLL_SINGLE,
  PROPOSAL_TEMPLATES,
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

import styles from './PostEditor.module.scss'

const emojiOptions = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '✅✅', '👍', '👎', '⁉️', '‼️', '❓', '❗', '🚫', '➡️', '🛑', '✅', '🛑🛑', '🌈', '🔴', '🔵', '🟤', '🟣', '🟢', '🟡', '🟠', '⚫', '⚪', '🤷🤷', '📆', '🤔', '❤️', '👏', '🎉', '🔥', '🤣', '😢', '😡', '🤷', '💃🕺', '⛔', '🙏', '👀', '🙌', '💯', '🔗', '🚀', '💃', '🕺', '🫶💯']
export const MAX_TITLE_LENGTH = 80

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
  post: propsPost = {
    type: 'discussion',
    title: '',
    details: '',
    groups: [],
    location: '',
    timezone: Moment.tz.guess()
  },
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
  const groupOptions = useMemo(() =>
    currentUser ? currentUser.memberships.toModelArray().map((m) => m.group).sort((a, b) => a.name.localeCompare(b.name)) : []
  , [currentUser?.memberships])
  const myAdminGroups = useSelector(state => getMyAdminGroups(state, groupOptions))

  const editingPostId = routeParams.postId
  const fromPostId = getQuerystringParam('fromPostId', location)

  const postType = getQuerystringParam('newPostType', urlLocation)
  const topicName = routeParams.topicName
  const topic = useSelector(state => getTopicForCurrentRoute(state, topicName))

  const linkPreview = useSelector(state => getLinkPreview(state)) // TODO: probably not working?
  // const [linkPreview, setLinkPreview] = useState(null)
  // const linkPreviewStatus = useSelector(state => get('linkPreviewStatus', state[MODULE_NAME]))
  const fetchLinkPreviewPending = useSelector(state => isPendingFor(FETCH_LINK_PREVIEW, state))
  const uploadAttachmentPending = useSelector(getUploadAttachmentPending)

  const attachmentPostId = (editingPostId || fromPostId)
  const uploadFileAttachmentPending = useSelector(state => getUploadAttachmentPending(state, { type: 'post', id: attachmentPostId, attachmentType: 'file' }))
  const uploadImageAttachmentPending = useSelector(state => getUploadAttachmentPending(state, { type: 'post', id: attachmentPostId, attachmentType: 'image' }))
  const imageAttachments = useSelector(state => getAttachments(state, { type: 'post', id: attachmentPostId, attachmentType: 'image' }), (a, b) => a.length === b.length && a.every((item, index) => item.id === b[index].id))
  const fileAttachments = useSelector(state => getAttachments(state, { type: 'post', id: attachmentPostId, attachmentType: 'file' }), (a, b) => a.length === b.length && a.every((item, index) => item.id === b[index].id))
  const postPending = useSelector(state => isPendingFor([CREATE_POST, CREATE_PROJECT], state))
  const loading = useSelector(state => isPendingFor(FETCH_POST, state)) || !!uploadAttachmentPending || postPending

  let post = propsPost
  const _editingPost = useSelector(state => getPost(state, editingPostId))
  const editingPost = useMemo(() => presentPost(_editingPost), [_editingPost])
  const _fromPost = useSelector(state => getPost(state, fromPostId))
  const fromPost = useMemo(() => presentPost(_fromPost), [_fromPost])

  if (routeParams.action === 'edit') {
    post = propsPost || editingPost
    editing = !!post || loading
  } else if (fromPostId) {
    post = propsPost || fromPost
    post.title = `Copy of ${post.title.slice(0, MAX_TITLE_LENGTH - 8)}`
  }

  const showImages = !isEmpty(imageAttachments) || uploadImageAttachmentPending
  const showFiles = !isEmpty(fileAttachments) || uploadFileAttachmentPending

  const titleInputRef = useRef()
  const editorRef = useRef()
  const groupsSelectorRef = useRef()

  const defaultPostWithGroupsAndTopic = useMemo(() => ({
    ...post,
    type: postType || post.type,
    groups: currentGroup ? [currentGroup] : [],
    topics: topic ? [topic] : [],
    acceptContributions: false,
    isPublic: context === 'public',
    isAnonymousVote: false,
    isStrictProposal: false,
    locationId: post?.locationObject?.id || null,
    proposalOptions: post?.proposalOptions || [],
    startTime: Moment(post.startTime),
    endTime: Moment(post.endTime),
    votingMethod: VOTING_METHOD_SINGLE
  }), [post?.id, postType, currentGroup, topic, context])

  const titlePlaceholderForPostType = (type) => {
    const titlePlaceHolders = {
      offer: t('Add a title'),
      request: t('Add a title'),
      resource: t('Add a title'),
      project: t('Add a title'),
      event: t('Add a title'),
      proposal: t('Add a title'),
      default: t('Add a title')
    }

    return (
      titlePlaceHolders[type] ||
      titlePlaceHolders.default
    )
  }

  const detailPlaceholderForPostType = (type) => {
    // XXX: right now we can't change these for post types otherwise changing post type will reset the HyloEditor content and lose content
    const detailPlaceHolders = {
      offer: t('Add a description'),
      request: t('Add a description'),
      resource: t('Add a description'),
      project: t('Add a description'),
      event: t('Add a description'),
      proposal: t('Add a description'),
      default: t('Add a description')
    }
    return (
      detailPlaceHolders[type] ||
      detailPlaceHolders.default
    )
  }

  const [currentPost, setCurrentPost] = useState(defaultPostWithGroupsAndTopic)
  const [titlePlaceholder, setTitlePlaceholder] = useState(titlePlaceholderForPostType(defaultPostWithGroupsAndTopic.type))
  const [detailPlaceholder, setDetailPlaceholder] = useState(detailPlaceholderForPostType(defaultPostWithGroupsAndTopic.type))
  const [valid, setValid] = useState(editing === true || !!post.title)
  const [announcementSelected, setAnnouncementSelected] = useState(false)
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [showPostTypeMenu, setShowPostTypeMenu] = useState(false)
  const [titleLengthError, setTitleLengthError] = useState(post.title?.length >= MAX_TITLE_LENGTH)
  const [dateError, setDateError] = useState(false)
  const [allowAddTopic, setAllowAddTopic] = useState(true)

  useEffect(() => {
    setTimeout(() => { titleInputRef.current && titleInputRef.current.focus() }, 100)
  }, [])

  useEffect(() => {
    editorRef.current.clearContent()
    groupsSelectorRef.current.reset()
    setCurrentPost(defaultPostWithGroupsAndTopic)
    editorRef.current.focus()
  }, [post.id, post.details])

  useEffect(() => {
    onUpdateLinkPreview()
  }, [linkPreview])

  useEffect(() => {
    return () => {
      dispatch(clearLinkPreview())
    }
  }, [])

  const onUpdateLinkPreview = () => {
    setCurrentPost({ ...currentPost, linkPreview })
  }

  const handlePostTypeSelection = (type) => (event) => {
    setIsDirty(true)
    navigate({
      pathname: urlLocation.pathname,
      search: setQuerystringParam('newPostType', type, urlLocation)
    }, { replace: true })

    setCurrentPost({ ...currentPost, type })
    setTitlePlaceholder(titlePlaceholderForPostType(type))
    setDetailPlaceholder(detailPlaceholderForPostType(type))
    setValid(isValid({ type }))
    setShowPostTypeMenu(!showPostTypeMenu)
  }

  const postTypeButtonProps = (forPostType) => {
    const { type } = currentPost
    const active = type === forPostType
    const className = cx(
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
          <Icon className={cx('icon', `icon-${forPostType}`)} name='ArrowDown' />
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
  }

  const handleTitleChange = (event) => {
    const title = event.target.value
    if (title !== currentPost.title) {
      title.length >= MAX_TITLE_LENGTH
        ? setTitleLengthError(true)
        : setTitleLengthError(false)
      setIsDirty(true)
      setCurrentPost({ ...currentPost, title })
      setValid(isValid({ title }))
    }
  }

  const handleDetailsChange = () => {
    setIsDirty(true)
  }

  const handleToggleContributions = () => {
    setCurrentPost({ ...currentPost, acceptContributions: !currentPost.acceptContributions })
  }

  const handleStartTimeChange = (startTime) => {
    validateTimeChange(startTime, currentPost.endTime)
    setCurrentPost({ ...currentPost, startTime })
    setValid(isValid({ startTime }))
  }

  const handleEndTimeChange = (endTime) => {
    validateTimeChange(currentPost.startTime, endTime)
    setCurrentPost({ ...currentPost, endTime })
    setValid(isValid({ endTime }))
  }

  const handledonationsLinkChange = (evt) => {
    const donationsLink = evt.target.value
    setCurrentPost({ ...currentPost, donationsLink })
    setValid(isValid({ donationsLink }))
  }

  const handleProjectManagementLinkChange = (evt) => {
    const projectManagementLink = evt.target.value
    setCurrentPost({ ...currentPost, projectManagementLink })
    setValid(isValid({ projectManagementLink }))
  }

  const validateTimeChange = (startTime, endTime) => {
    if (endTime) {
      startTime < endTime
        ? setDateError(false)
        : setDateError(true)
    }
  }

  const handleLocationChange = (locationObject) => {
    setCurrentPost({
      ...currentPost,
      location: locationObject.fullText,
      locationId: locationObject.id
    })
    setValid(isValid({ locationId: locationObject.id }))
  }

  // Checks for linkPreview every 1/2 second
  const handleAddLinkPreview = debounce(500, (url, force) => {
    const { linkPreview } = post
    if (linkPreview && !force) return
    pollingFetchLinkPreview(url)
  })

  const handleTopicSelectorOnChange = topics => {
    setCurrentPost({ ...currentPost, topics })
    setAllowAddTopic(false)
    setIsDirty(true)
  }

  const handleAddTopic = topic => {
    const { topics } = currentPost

    if (!allowAddTopic || topics?.length >= MAX_POST_TOPICS) return

    setCurrentPost({ ...currentPost, topics: [...topics, topic] })
    setIsDirty(true)
  }

  const handleFeatureLinkPreview = featured => {
    setCurrentPost({ ...currentPost, linkPreviewFeatured: featured })
  }

  const handleRemoveLinkPreview = () => {
    dispatch(removeLinkPreview())
    setCurrentPost({ ...currentPost, linkPreview: null, linkPreviewFeatured: false })
  }

  const handleSetSelectedGroups = (groups) => {
    const hasChanged = !isEqual(post.groups, groups)

    setCurrentPost({ ...currentPost, groups })
    setValid(isValid({ groups }))

    if (hasChanged) {
      setIsDirty(true)
    }
  }

  const togglePublic = () => {
    const { isPublic } = currentPost
    setCurrentPost({ ...currentPost, isPublic: !isPublic })
  }

  const toggleAnonymousVote = () => {
    const { isAnonymousVote } = currentPost
    setCurrentPost({ ...currentPost, isAnonymousVote: !isAnonymousVote })
  }

  // const toggleStrictProposal = () => {
  //   const { isStrictProposal } = currentPost
  //   setCurrentPost({ ...currentPost, isStrictProposal: !isStrictProposal })
  // }

  const handleUpdateProjectMembers = (members) => {
    setCurrentPost({ ...currentPost, members })
  }

  const handleUpdateEventInvitations = (eventInvitations) => {
    setCurrentPost({ ...currentPost, eventInvitations })
  }

  const isValid = (postUpdates = {}) => {
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
  }

  // const handleCancel = () => {
  //   if (onCancel) {
  //     onCancel()
  //     return true
  //   }
  // }

  const save = async () => {
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
    } = post
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

    console.log("proposaloptions", proposalOptions)
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
    const saveFunc = editing ? updatePost : createPost
    setAnnouncementSelected(false)
    const action = await dispatch(saveFunc(postToSave))
    goToPost(action)
  }

  const goToPost = (createPostAction) => {
    const id = get('payload.data.createPost.id', createPostAction)
    const querystringWhitelist = ['s', 't', 'q', 'search', 'zoom', 'center', 'lat', 'lng']
    const querystringParams = urlLocation && getQuerystringParam(querystringWhitelist, urlLocation)
    const postPath = postUrl(id, routeParams, querystringParams)
    navigate(postPath)
  }

  const buttonLabel = () => {
    if (postPending) return t('Posting...')
    if (editing) return t('Save')
    return t('Post')
  }

  const toggleAnnouncementModal = () => {
    setShowAnnouncementModal(!showAnnouncementModal)
  }

  const togglePostTypeMenu = () => {
    setShowPostTypeMenu(!showPostTypeMenu)
  }

  const handleSetQuorum = (quorum) => {
    setCurrentPost({ ...currentPost, quorum })
  }

  const handleSetProposalType = (votingMethod) => {
    setCurrentPost({ ...currentPost, votingMethod })
  }

  const handleUseTemplate = (template) => {
    const templateData = PROPOSAL_TEMPLATES[template]
    setCurrentPost({
      ...currentPost,
      proposalOptions: templateData.form.proposalOptions.map(option => { return { ...option, tempId: generateTempID() } }),
      title: currentPost.title.length > 0 ? currentPost.title : templateData.form.title,
      quorum: templateData.form.quorum,
      votingMethod: templateData.form.votingMethod
    })
    setValid(isValid({ proposalOptions: templateData.form.proposalOptions }))
  }

  const handleAddOption = () => {
    const { proposalOptions } = currentPost
    const newOptions = [...proposalOptions, { text: '', emoji: '', color: '', tempId: generateTempID() }]
    setCurrentPost({ ...currentPost, proposalOptions: newOptions })
    setValid(isValid({ proposalOptions: newOptions }))
  }

  const canMakeAnnouncement = () => {
    const { groups = [] } = currentPost
    const myAdminGroupsSlugs = myAdminGroups.map(group => group.slug)
    for (let index = 0; index < groups.length; index++) {
      if (!myAdminGroupsSlugs.includes(groups[index].slug)) return false
    }
    return true
  }

  const canHaveTimes = currentPost.type !== 'discussion'
  const hasLocation = currentPost.type !== 'chat'
  const postLocation = currentPost.location || selectedLocation
  const locationPrompt = currentPost.type === 'proposal' ? t('Is there a relevant location for this proposal?') : t('Where is your {{type}} located?', { type: currentPost.type })
  const hasStripeAccount = get('hasStripeAccount', currentUser)
  const invalidPostWarning = currentPost.type === 'proposal' ? t('You need a title, a group and at least one option for a proposal') : t('You need a title and at least one group to post')

  return (
    <div className={cx(styles.wrapper, { [styles.hide]: showAnnouncementModal })}>
      <div className={styles.header}>
        <div className={styles.initial}>
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
      </div>
      <div className={styles.body}>
        <div className={styles.bodyColumn}>
          <RoundImage
            medium
            className={styles.titleAvatar}
            url={currentUser && currentUser.avatarUrl}
          />
        </div>
        <div className={styles.bodyColumn}>
          <input
            type='text'
            className={styles.titleInput}
            placeholder={titlePlaceholder}
            value={currentPost.title || ''}
            onChange={handleTitleChange}
            disabled={loading}
            ref={titleInputRef}
            maxLength={MAX_TITLE_LENGTH}
          />
          {titleLengthError && (
            <span className={styles.titleError}>{t('Title limited to {{maxTitleLength}} characters', { maxTitleLength: MAX_TITLE_LENGTH })}</span>
          )}
          <HyloEditor
            className={styles.editor}
            placeholder={detailPlaceholder}
            onUpdate={handleDetailsChange}
            // Disable edit cancel through escape due to event bubbling issues
            // onEscape={handleCancel}
            onAddTopic={handleAddTopic}
            onAddLink={handleAddLinkPreview}
            contentHTML={currentPost.details}
            showMenu
            readOnly={loading}
            ref={editorRef}
          />
        </div>
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
      <div className={styles.footer}>
        {currentPost.type === 'project' && (
          <div className={styles.footerSection}>
            <div className={styles.footerSectionLabel}>{t('Project Members')}</div>
            <div className={styles.footerSectionGroups}>
              <MemberSelector
                initialMembers={currentPost.members || []}
                onChange={handleUpdateProjectMembers}
                forGroups={currentPost.groups}
                readOnly={loading}
              />
            </div>
          </div>
        )}
        <div className={styles.footerSection}>
          <div className={styles.footerSectionLabel}>{t('Topics')}</div>
          <div className={styles.footerSectionTopics}>
            <TopicSelector
              forGroups={currentPost?.groups || [currentGroup]}
              selectedTopics={currentPost.topics}
              onChange={handleTopicSelectorOnChange}
            />
          </div>
        </div>
        <div className={styles.footerSection}>
          <div className={styles.footerSectionLabel}>{t('Post in')}*</div>
          <div className={styles.footerSectionGroups}>
            <GroupsSelector
              options={groupOptions}
              selected={currentPost.groups}
              onChange={handleSetSelectedGroups}
              readOnly={loading}
              ref={groupsSelectorRef}
            />
          </div>
        </div>
        <PublicToggle
          togglePublic={togglePublic}
          isPublic={!!currentPost.isPublic}
        />
        {currentPost.type === 'proposal' && currentPost.proposalOptions.length === 0 && (
          <div className={styles.footerSection}>
            <div className={styles.footerSectionLabel}>{t('Proposal template')}</div>

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
          <div className={styles.footerSection}>
            <div className={styles.footerSectionLabel}>
              {t('Proposal options')}*
            </div>
            <div className={styles.optionsContainer}>
              {currentPost.proposalOptions.map((option, index) => (
                <div className={styles.proposalOption} key={index}>
                  {/* emojiPicker dropdown */}
                  <Dropdown
                    className={styles.optionDropdown}
                    toggleChildren={
                      <span className={cx(styles.optionDropdownLabel, styles.dropdownLabel)}>
                        {option.emoji || t('Emoji')}
                        <Icon name='ArrowDown' blue className={cx(styles.optionDropdownIcon, styles.blue)} />
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
              {currentPost && !isEqual(currentPost.proposalOptions, post.proposalOptions) && (
                <div className={cx(styles.proposalOption, styles.warning)} onClick={() => handleAddOption()}>
                  <Icon name='Hand' className={styles.iconPlus} />
                  <span className={styles.optionText}>{t('If you save changes to options, all votes will be discarded')}</span>
                </div>
              )}
              {currentPost.proposalOptions.length === 0 && (
                <div className={cx(styles.proposalOption, styles.warning)} onClick={() => handleAddOption()}>
                  <Icon name='Hand' className={styles.iconPlus} />
                  <span className={styles.optionText}>{t('Proposals require at least one option')}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {currentPost.type === 'proposal' && (
          <div className={styles.footerSection}>
            <div className={styles.footerSectionLabel}>{t('Voting method')}</div>

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
          <div className={styles.footerSection}>
            <div className={styles.footerSectionLabel}>{t('Quorum')} <Icon name='Info' className={cx(styles.quorumTooltip)} data-tip={t('quorumExplainer')} data-tip-for='quorum-tt' /></div>
            <SliderInput percentage={currentPost.quorum} setPercentage={handleSetQuorum} />
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
            isStrictProposal={!!post.isStrictProposal}
            toggleStrictProposal={toggleStrictProposal}
          />
        )} */}
        {canHaveTimes && (
          <div className={styles.footerSection}>
            <div className={styles.footerSectionLabel}>{currentPost.type === 'proposal' ? t('Voting window') : t('Timeframe')}</div>
            <div className={styles.datePickerModule}>
              <DatePicker
                value={currentPost.startTime}
                placeholder={t('Select Start')}
                onChange={handleStartTimeChange}
              />
              <div className={styles.footerSectionHelper}>{t('To')}</div>
              <DatePicker
                value={currentPost.endTime}
                placeholder={t('Select End')}
                onChange={handleEndTimeChange}
              />
            </div>
          </div>
        )}
        {canHaveTimes && dateError && (
          <span className={styles.datepickerError}>
            {t('End Time must be after Start Time')}
          </span>
        )}
        {hasLocation && (
          <div className={styles.footerSection}>
            <div className={cx(styles.footerSectionLabel, styles.alignedLabel)}>{t('Location')}</div>
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
          <div className={styles.footerSection}>
            <div className={styles.footerSectionLabel}>{t('Invite People')}</div>
            <div className={styles.footerSectionGroups}>
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
          <div className={styles.footerSection}>
            <div className={styles.footerSectionLabel}>{t('Accept Contributions')}</div>
            {hasStripeAccount && (
              <div
                className={cx(styles.footerSectionGroups, styles.acceptContributions)}
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
                className={cx(
                  styles.footerSectionGroups,
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
          <div className={styles.footerSection}>
            <div className={cx(styles.footerSectionLabel, { [styles.warning]: !!currentPost.donationsLink && !sanitizeURL(currentPost.donationsLink) })}>{t('Donation Link')}</div>
            <div className={styles.footerSectionGroups}>
              <input
                type='text'
                className={styles.textInput}
                placeholder={t('Add a donation link (must be valid URL)')}
                value={currentPost.donationsLink || ''}
                onChange={handledonationsLinkChange}
                disabled={loading}
              />
            </div>
          </div>
        )}
        {currentPost.type === 'project' && (
          <div className={styles.footerSection}>
            <div className={cx(styles.footerSectionLabel, { [styles.warning]: !!currentPost.projectManagementLink && !sanitizeURL(currentPost.projectManagementLink) })}>{t('Project Management')}</div>
            <div className={styles.footerSectionGroups}>
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
          showImages={showImages}
          showFiles={showFiles}
          valid={valid}
          loading={loading}
          submitButtonLabel={buttonLabel()}
          save={() => {
            if (currentPost.type === 'proposal' && !isEqual(currentPost.proposalOptions, post.proposalOptions)) {
              if (window.confirm(t('Changing proposal options will reset the votes. Are you sure you want to continue?'))) {
                save()
              }
            } else {
              save()
            }
          }}
          setAnnouncementSelected={setAnnouncementSelected}
          announcementSelected={announcementSelected}
          canMakeAnnouncement={canMakeAnnouncement()}
          toggleAnnouncementModal={toggleAnnouncementModal}
          showAnnouncementModal={showAnnouncementModal}
          groupCount={get('groups', post).length}
          myAdminGroups={myAdminGroups}
          groups={post.groups}
          invalidPostWarning={invalidPostWarning}
          t={t}
        />
      </div>
    </div>
  )
}

export function ActionsBar ({
  id,
  addAttachment,
  showImages,
  showFiles,
  valid,
  loading,
  submitButtonLabel,
  save,
  setAnnouncementSelected,
  announcementSelected,
  toggleAnnouncementModal,
  showAnnouncementModal,
  groupCount,
  canMakeAnnouncement,
  myAdminGroups,
  groups,
  invalidPostWarning,
  t
}) {
  return (
    <div className={styles.actionsBar}>
      <div className={styles.actions}>
        <UploadAttachmentButton
          type='post'
          id={id}
          attachmentType='image'
          onSuccess={(attachment) => addAttachment('post', id, attachment)}
          allowMultiple
          disable={showImages}
        >
          <Icon
            name='AddImage'
            className={cx(styles.actionIcon, { [styles.highlightIcon]: showImages })}
          />
        </UploadAttachmentButton>
        <UploadAttachmentButton
          type='post'
          id={id}
          attachmentType='file'
          onSuccess={(attachment) => addAttachment('post', id, attachment)}
          allowMultiple
          disable={showFiles}
        >
          <Icon
            name='Paperclip'
            className={cx(styles.actionIcon, { [styles.highlightIcon]: showFiles })}
          />
        </UploadAttachmentButton>
        {canMakeAnnouncement && (
          <span data-tooltip-content='Send Announcement' data-tooltip-id='announcement-tt'>
            <Icon
              name='Announcement'
              onClick={() => setAnnouncementSelected(!announcementSelected)}
              className={cx(styles.actionIcon, {
                [styles.highlightIcon]: announcementSelected
              })}
            />
            <ReactTooltip
              effect='solid'
              delayShow={550}
              id='announcement-tt'
            />
          </span>
        )}
        {showAnnouncementModal && (
          <SendAnnouncementModal
            closeModal={toggleAnnouncementModal}
            save={save}
            groupCount={groupCount}
            myAdminGroups={myAdminGroups}
            groups={groups}
          />
        )}
      </div>
      <Button
        onClick={announcementSelected ? toggleAnnouncementModal : save}
        disabled={!valid || loading}
        className={styles.postButton}
        label={submitButtonLabel}
        color='green'
        dataTip={!valid ? invalidPostWarning : ''}
        dataFor='submit-tt'
      />
      <Tooltip
        delay={150}
        position='bottom'
        id='submit-tt'
      />
    </div>
  )
}

export default PostEditor
