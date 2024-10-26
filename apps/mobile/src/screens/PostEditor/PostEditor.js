/* eslint-disable react/no-unstable-nested-components */
import React, { useState, useMemo, useCallback } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import RNPickerSelect from 'react-native-picker-select'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { get, uniq, uniqBy, isEmpty } from 'lodash/fp'
import moment from 'moment-timezone'
import { Validators, TextHelpers } from '@hylo/shared'
import { isIOS } from 'util/platform'
import { showToast, hideToast } from 'util/toast'
import useCurrentUser from 'urql-shared/hooks/useCurrentUser'
import useCurrentGroup from 'hooks/useCurrentGroup'
import fetchPostAction from 'store/actions/fetchPost'
import createPostAction from 'store/actions/createPost'
import createProjectAction from 'store/actions/createProject'
import updatePostAction from 'store/actions/updatePost'
import uploadAction from 'store/actions/upload'
import { pollingFindOrCreateLocation as providedPollingFindOrCreateLocation } from 'screens/LocationPicker/LocationPicker.store'
import isPendingFor from 'store/selectors/isPendingFor'
import { getPresentedPost } from 'store/selectors/getPost'
// Components
import LocationPicker from 'screens/LocationPicker/LocationPicker'
// TODO: Convert all 3 of the below to LocationPicker style calls
// ProjectMembers Chooser
import scopedFetchPeopleAutocomplete from 'store/actions/scopedFetchPeopleAutocomplete'
import scopedGetPeopleAutocomplete from 'store/selectors/scopedGetPeopleAutocomplete'
// Topics Picker
import fetchTopicsForGroupId from 'store/actions/fetchTopicsForGroupId'
import getTopicsForAutocompleteWithNew from 'store/selectors/getTopicsForAutocompleteWithNew'
import TopicRow from 'screens/TopicList/TopicRow'
// Group Chooser
import GroupChooserItemRow from 'screens/ItemChooser/GroupChooserItemRow'
import GroupsList from 'components/GroupsList'
import DatePicker from 'react-native-date-picker'
import Button from 'components/Button'
import FileSelector, { showFilePicker as fileSelectorShowFilePicker } from './FileSelector'
import HyloEditorWebView from 'components/HyloEditorWebView'
import Icon from 'components/Icon'
import ImagePicker from 'components/ImagePicker'
import ImageSelector from './ImageSelector'
import ItemChooserItemRow from 'screens/ItemChooser/ItemChooserItemRow'
import Loading from 'components/Loading'
import ProjectMembersSummary from 'components/ProjectMembersSummary'
import Topics from 'components/Topics'
import styles, { typeSelectorStyles } from './PostEditor.styles'
import HeaderLeftCloseIcon from 'navigation/headers/HeaderLeftCloseIcon'
import confirmDiscardChanges from 'util/confirmDiscardChanges'
import { caribbeanGreen, rhino30, rhino80, white } from 'style/colors'
import useRouteParams from 'hooks/useRouteParams'

export const MAX_TITLE_LENGTH = 50

const titlePlaceholders = {
  discussion: 'Create a post',
  request: 'What are you looking for help with?',
  offer: 'What help can you offer?',
  resource: 'What resource is available?',
  project: 'What would you like to call your project?',
  proposal: 'What is your proposal?',
  event: 'What is your event called?'
}

export default function PostEditorContainer(props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigation = useNavigation()
  const isFocused = useIsFocused()
  const currentUser = useCurrentUser()
  const [currentGroup] = useCurrentGroup()
  const routeParams = useRouteParams()
  
  const {
    id: postId,
    lat: mapCoordinateLat,
    lng: mapCoordinateLng,
    topicName: selectedTopicName,
    type: providedType
  } = routeParams

  const post = useSelector(state => getPresentedPost(state, { postId }))
  const postLoading = useSelector(state => isPendingFor(fetchPostAction, state))

  const groupOptions = useMemo(() => {
    return props.groupOptions || (currentUser?.memberships.map(m => m.group) || [])
  }, [props.groupOptions, currentUser])

  const mapCoordinate = useMemo(() => {
    return mapCoordinateLat && mapCoordinateLng ? { lat: mapCoordinateLat, lng: mapCoordinateLng } : null
  }, [mapCoordinateLat, mapCoordinateLng])

  const defaultPost = useMemo(() => {
    const basePost = selectedTopicName
      ? { topics: [{ name: selectedTopicName }], groups: currentGroup ? [currentGroup] : [] }
      : { groups: currentGroup ? [currentGroup] : [] }
    if (providedType) basePost.type = providedType
    return basePost
  }, [selectedTopicName, currentGroup, providedType])

  const fetchPost = useCallback(params => dispatch(fetchPostAction(params)), [dispatch])
  const createPost = useCallback(params => dispatch(createPostAction(params)), [dispatch])
  const createProject = useCallback(params => dispatch(createProjectAction(params)), [dispatch])
  const updatePost = useCallback(params => dispatch(updatePostAction(params)), [dispatch])
  const upload = useCallback(params => dispatch(uploadAction(params)), [dispatch])

  const pollingFindOrCreateLocation = useCallback((locationData, callback) => {
    return providedPollingFindOrCreateLocation(dispatch, locationData, locationObject => callback(locationObject))
  }, [dispatch])

  return (
    <PostEditor 
      {...props}
      currentUser={currentUser}
      currentGroup={currentGroup}
      groupOptions={groupOptions}
      isFocused={isFocused}
      mapCoordinate={mapCoordinate}
      navigation={navigation}
      post={post || defaultPost}
      fetchPost={fetchPost}
      createPost={createPost}
      createProject={createProject}
      updatePost={updatePost}
      upload={upload}
      pollingFindOrCreateLocation={pollingFindOrCreateLocation}
      postLoading={postLoading}
      t={t}
    />
  )
}

export class PostEditor extends React.Component {
  constructor (props) {
    super(props)

    const { post } = props

    this.scrollViewRef = React.createRef()
    this.detailsEditorRef = React.createRef()
    this.state = {
      isNewPost: !post?.id,
      title: post?.title || '',
      type: post?.type || 'discussion',
      groups: post?.groups || [],
      images: post?.imageUrls
        ? post
          .imageUrls
          .map(imageUrl => ({ remote: imageUrl, local: imageUrl }))
        : [],
      files: post?.fileUrls
        ? post
          .fileUrls
          .map(fileUrl => ({ remote: fileUrl, local: fileUrl }))
        : [],
      topics: post?.topics || [],
      members: post?.members || [],
      topicsPicked: false,
      announcementEnabled: false,
      detailsFocused: false,
      details: post?.details,
      titleLengthError: false,
      startTime: post?.startTime
        ? new Date(post.startTime)
        : null,
      endTime: post?.endTime
        ? new Date(post.endTime)
        : null,
      location: post?.location,
      locationObject: post?.locationObject,
      donationsLink: post?.donationsLink,
      projectManagementLink: post?.projectManagementLink,
      isPublic: false,
      startTimeExpanded: false,
      endTimeExpanded: false,
      isValid: post?.id,
      isSaving: false
    }
  }

  componentDidMount () {
    const { isNewPost } = this.state
    const { fetchPost, pollingFindOrCreateLocation, mapCoordinate, t } = this.props
    if (!isNewPost) {
      fetchPost()
    } else {
      if (mapCoordinate) {
        const locationObject = {
          fullText: `${mapCoordinate.lat},${mapCoordinate.lng}`,
          center: {
            lat: parseFloat(mapCoordinate.lat),
            lng: parseFloat(mapCoordinate.lng)
          }
        }
        pollingFindOrCreateLocation(locationObject, this.handlePickLocation)
      }
    }

    this.removeBeforeRemove = this.props.navigation.addListener('beforeRemove', (e) => {
      e.preventDefault()
      confirmDiscardChanges({
        onDiscard: () => this.props.navigation.dispatch(e.data.action),
        title: t('Are you sure?'),
        confirmationMessage: t('If you made changes they will be lost'),
        t
      })
    })

    this.renderReactNavigationHeader()
  }

  shouldComponentUpdate (nextProps, nextState) {
    return nextProps.isFocused
  }

  componentWillUnmount () {
    this.removeBeforeRemove()
  }

  save = async () => {
    if (!this.detailsEditorRef?.current) {
      this.setIsSaving(false)
      return
    }
    const {
      createPost, createProject, updatePost,
      navigation, post
    } = this.props
    const {
      files, images, title,
      topics, type, announcementEnabled, members,
      groups, startTime, endTime, location, isPublic,
      locationObject, donationsLink, projectManagementLink
    } = this.state
    const postData = {
      id: post.id,
      type,
      details: this.detailsEditorRef.current.getHTML(),
      groups,
      memberIds: members.map(m => m.id),
      fileUrls: uniq(files.filter(file => file.remote).map(file => file.remote)),
      imageUrls: uniq(images.filter(image => image.remote).map(image => image.remote)),
      isPublic,
      title,
      sendAnnouncement: announcementEnabled,
      topicNames: topics.map(t => t.name),
      startTime: startTime && startTime.getTime(),
      endTime: endTime && endTime.getTime(),
      location,
      projectManagementLink: TextHelpers.sanitizeURL(projectManagementLink),
      donationsLink: TextHelpers.sanitizeURL(donationsLink),
      locationId: (locationObject && locationObject?.id) ? locationObject.id : null
    }

    try {
      const saveAction = postData.id
        ? updatePost
        : postData.type === 'project'
          ? createProject
          : createPost
      const { payload, meta, error } = await saveAction(postData)

      if (error) {
        // TODO: handle API errors more appropriately
        throw new Error('Error submitting post')
      }

      const id = meta.extractModel?.getRoot(payload?.data)?.id

      navigation.navigate('Post Details', { id })
    } catch (e) {
      console.log('!!!! error saving post', e)
      this.setIsSaving(false)
    }
  }

  handleSave = () => {
    const { announcementEnabled } = this.state
    const { t } = this.props

    this.setIsSaving(true)

    if (announcementEnabled) {
      Alert.alert(
        t('makeAnAnnouncement'),
        t('announcementExplainer'),
        [
          {
            text: t('Send It'),
            onPress: this.save
          },
          {
            text: t('Go Back'),
            style: 'cancel',
            onPress: () => this.setIsSaving(false)
          }
        ])
    } else {
      this.save()
    }
  }

  handleCancel = () => {
    // Note: Delegated to dismiss event listener
    this.props.navigation.goBack()
  }

  setIsSaving = isSaving => {
    this.setState({ isSaving }, this.setIsValid)
  }

  setIsValid = (updatedState = {}) => {
    const {
      type, title, groups, startTime, endTime, images, files,
      donationsLink, projectManagementLink
    } = Object.assign(
      {},
      this.state,
      updatedState
    )
    const imagesLoading = images.find(image => !image?.remote)
    const filesLoading = files.find(file => !file?.remote)

    if (
      imagesLoading ||
      filesLoading ||
      (!title || title.length < 1) ||
      isEmpty(groups) ||
      (type === 'event' && (!startTime || !endTime)) ||
      (donationsLink && !TextHelpers.sanitizeURL(donationsLink)) ||
      (projectManagementLink && !TextHelpers.sanitizeURL(projectManagementLink))

    ) {
      this.setState({ isValid: false }, this.renderReactNavigationHeader)
    } else {
      this.setState({ isValid: true }, this.renderReactNavigationHeader)
    }
  }

  handleUpdateType = type => {
    this.setState({ type }, this.setIsValid)
  }

  handleUpdateTitle = title => {
    switch (title.length >= MAX_TITLE_LENGTH) {
      case true:
        this.setState({ titleLengthError: true }, this.setIsValid)
        break
      case false:
        this.setState({ title, titleLengthError: false }, this.setIsValid)
        break
    }
  }

  handleUpdateDetails = details => {
    this.setState({ details }, this.setIsValid)
  }

  // Assumptions:
  // - maximum of three topics per post are allowed
  // - topics must be unique
  // - priority is given to topics already on the post (preserve order)
  handleAddTopic = (providedTopic, picked) => {
    const topic = { ...providedTopic, name: this.ignoreHash(providedTopic.name) }

    if (Validators.validateTopicName(topic.name) === null) {
      this.setState({
        topics: uniqBy(t => t.name, [...this.state.topics, topic]).slice(0, 3),
        topicsPicked: picked !== undefined ? picked : this.state.topicsPicked
      })
    }
  }

  handleRemoveTopic = topic => {
    this.setState({
      topics: this.state.topics.filter(t => t.id !== topic.id),
      topicsPicked: true
    })
  }

  handlePickLocation = locationObject => {
    this.setState(() => ({
      location: locationObject.fullText,
      locationObject: (locationObject && locationObject?.id !== 'NEW') ? locationObject : null
    }))
  }

  handleUpdateProjectMembers = members => this.setState(state => ({ members }))

  handleAddGroup = group => {
    const groups = uniqBy(c => c.id, [...this.state.groups, group])

    this.setState({ groups }, this.setIsValid)
  }

  handleRemoveGroup = groupSlug => {
    this.setState(state => ({
      groups: state.groups.filter(group => group.slug !== groupSlug)
    }))
  }

  handleAddAttachmentForKey = key => ({ local, remote }) => {
    let attachmentsForKey = this.state[key] || []
    const existingIndex = attachmentsForKey.findIndex(attachment => attachment.local === local)

    if (existingIndex >= 0) {
      attachmentsForKey[existingIndex].remote = remote
    } else {
      attachmentsForKey = [...attachmentsForKey, { local, remote }]
    }

    // NOTE: `uniqBy` de-duping of local file uploads here won't do
    // anything at least in iOS, as each file selection is copied into
    // a unique `tmp` location on the device each time it's selected.
    this.setState({ [key]: uniqBy('local', attachmentsForKey) }, this.setIsValid)
  }

  handleRemoveAttachmentForKey = key => ({ local }) => {
    this.setState({ [key]: this.state[key].filter(attachment => attachment.local !== local) }, this.setIsValid)
  }

  handleAttachmentUploadErrorForKey = key => (errorMessage, attachment) => {
    this.handleRemoveAttachmentForKey(key)(attachment)
    Alert.alert(errorMessage)
  }

  handleTogglePublicPost = () => {
    this.setState({ isPublic: !this.state.isPublic })
  }

  handleShowProjectMembersEditor = () => {
    const { navigation, t } = this.props
    const { members } = this.state
    const screenTitle = t('Project Members')
    navigation.navigate('ItemChooser', {
      screenTitle,
      searchPlaceholder: t('Type in the names of people to add to project'),
      ItemRowComponent: ItemChooserItemRow,
      initialItems: members,
      updateItems: this.handleUpdateProjectMembers,
      fetchSearchSuggestions: scopedFetchPeopleAutocomplete,
      getSearchSuggestions: scopedGetPeopleAutocomplete(screenTitle)
    })
  }

  handleShowTopicsPicker = () => {
    console.log('!!! here')
    const { navigation, t } = this.props
    const screenTitle = t('Pick a Topic')
    navigation.navigate('ItemChooser', {
      screenTitle,
      searchPlaceholder: t('Search for a topic by name'),
      ItemRowComponent: TopicRow,
      pickItem: topic => { this.handleAddTopic(topic, true) },
      // FIX: Will only find topics for first group
      fetchSearchSuggestions: fetchTopicsForGroupId(get('[0].id', this.state.groups)),
      getSearchSuggestions: getTopicsForAutocompleteWithNew
    })
  }

  handleShowGroupsEditor = () => {
    const { navigation, groupOptions, t } = this.props
    const screenTitle = t('Post in Groups')
    navigation.navigate('ItemChooser', {
      screenTitle,
      searchPlaceholder: t('Search for group by name'),
      defaultSuggestedItemsLabel: t('Your Groups'),
      defaultSuggestedItems: groupOptions,
      ItemRowComponent: GroupChooserItemRow,
      pickItem: this.handleAddGroup,
      fetchSearchSuggestions: () => ({ type: 'none' }),
      getSearchSuggestions: (_, { autocomplete: searchTerm }) =>
        groupOptions.filter(c => c.name.toLowerCase().match(searchTerm?.toLowerCase()))
    })
  }

  handleShowLocationPicker = () => {
    LocationPicker({
      navigation: this.props.navigation,
      initialSearchTerm: this.state?.location,
      onPick: this.handlePickLocation,
      t: this.props.t
    })
  }

  handleDonationsLink = donationsLink => {
    this.setState({ donationsLink }, this.setIsValid)
  }

  handleProjectManagementLink = projectManagementLink => {
    this.setState({ projectManagementLink }, this.setIsValid)
  }

  handleShowFilePicker = async () => {
    this.setState({ filePickerPending: true })
    await fileSelectorShowFilePicker({
      upload: this.props.upload,
      type: 'post',
      id: this.props?.post?.id,
      onAdd: this.handleAddAttachmentForKey('files'),
      onError: () => {
        this.setState({ filePickerPending: false }, this.setIsValid)
        this.handleAttachmentUploadErrorForKey('files')
      },
      onComplete: () => this.setState({ filePickerPending: false }, this.setIsValid),
      onCancel: () => this.setState({ filePickerPending: false }, this.setIsValid)
    })
  }

  handleToggleAnnouncement = () => {
    this.toast && hideToast(this.toast)
    this.toast = showToast(
      `announcement ${!this.state.announcementEnabled ? 'on' : 'off'}`,
      { isError: this.state.announcementEnabled }
    )
    this.setState({ announcementEnabled: !this.state.announcementEnabled })
  }

  ignoreHash = name => name[0] === '#' ? name.slice(1) : name

  renderReactNavigationHeader = () => {
    const { navigation } = this.props

    navigation.setOptions({
      headerShown: true,
      header: this.renderHeader
    })
  }

  renderHeader = () => {
    const { t } = this.props
    const { isValid, isSaving, isNewPost, type } = this.state
    const headerRightButtonLabel = isSaving
      ? t('Saving-ellipsis')
      : isNewPost
        ? t('Post')
        : t('Save')

    return (
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <HeaderLeftCloseIcon
            style={styles.headerCloseIcon}
            color={rhino30}
            onPress={this.handleCancel}
          />
          <TypeSelector
            disabled={isSaving || type === 'proposal'}
            onValueChange={this.handleUpdateType}
            placeholder={{}}
            value={type}
          />
          <Button
            style={styles.headerSaveButton}
            disabled={isSaving || !isValid}
            onPress={this.handleSave}
            text={headerRightButtonLabel}
          />
        </View>
      </View>
    )
  }

  renderForm = () => {
    const { post, postLoading, t } = this.props
    const {
      isSaving, topics, title, type, filePickerPending, announcementEnabled,
      titleLengthError, members, groups, startTime, endTime, location, donationsLink,
      locationObject, projectManagementLink, isPublic, topicsPicked, files, images
    } = this.state
    const canHaveTimeframe = type !== 'discussion'

    t('Create a post')
    t('What are you looking for help with?')
    t('What help can you offer?')
    t('What resource is available?')
    t('What would you like to call your project?')
    t('What is your proposal?')
    t('What is your event called?')

    return (
      <View style={styles.formContainer}>

        {/*  Form Top */}

        <View style={styles.formTop}>
          <View style={[styles.titleInputWrapper]}>
            <TextInput
              style={[styles.titleInput]}
              editable={!isSaving}
              onChangeText={this.handleUpdateTitle}
              placeholder={t(titlePlaceholders[type])}
              placeholderTextColor={rhino30}
              underlineColorAndroid='transparent'
              autoCorrect={false}
              value={title}
              multiline
              numberOfLines={2}
              blurOnSubmit
              maxLength={MAX_TITLE_LENGTH}
            />
            {titleLengthError && (
              <Text style={styles.titleInputError}>😬 {MAX_TITLE_LENGTH} {t('characters max')}</Text>
            )}
          </View>

          <View style={[styles.textInputWrapper, styles.detailsInputWrapper]}>
            <HyloEditorWebView
              placeholder={t('Add a description')}
              contentHTML={post?.details}
              // groupIds={groupOptions && groupOptions.map(g => g.id)}
              onChange={this.handleUpdateDetails}
              onAddTopic={!topicsPicked && this.handleAddTopic}
              readOnly={postLoading || isSaving}
              ref={this.detailsEditorRef}
              widthOffset={0}
              customEditorCSS={`
                min-height: 90px
              `}
            />
          </View>

          <TouchableOpacity
            style={[styles.pressSelectionSection, styles.topics]}
            onPress={this.handleShowTopicsPicker}
          >
            <View style={styles.pressSelection}>
              <Text style={styles.pressSelectionLeftText}>{t('Topics')}</Text>
              <View style={styles.pressSelectionRight}><Icon name='Plus' style={styles.pressSelectionRightIcon} /></View>
            </View>
            <Topics
              style={styles.pressSelectionValue}
              pillStyle={styles.topicPillStyle}
              textStyle={styles.topicTextStyle}
              onPress={this.handleShowTopicsPicker}
              onPressRemove={this.handleRemoveTopic}
              topics={topics}
            />
          </TouchableOpacity>

          {type === 'proposal' && (
            <View style={styles.pressSelection}>
              <Text style={styles.pressSelectionLeftText}>{t('Proposal details can be edited in the web-app')}</Text>
            </View>
          )}

          {type === 'project' && (
            <TouchableOpacity style={styles.pressSelectionSection} onPress={this.handleShowProjectMembersEditor}>
              <View style={styles.pressSelection}>
                <Text style={styles.pressSelectionLeftText}>{t('Project Members')}</Text>
                <View style={styles.pressSelectionRight}><Icon name='Plus' style={styles.pressSelectionRightIcon} /></View>
              </View>
              {members.length > 0 && <ProjectMembersSummary style={styles.pressSelectionValue} members={members} />}
            </TouchableOpacity>
          )}

          {canHaveTimeframe && (
            <>
              <DatePickerWithLabel
                style={styles.pressSelectionSection}
                label={t('Start Time')}
                date={startTime}
                minimumDate={new Date()}
                onSelect={startTime => this.setState({ startTime }, this.setIsValid)}
              />
              <DatePickerWithLabel
                style={styles.pressSelectionSection}
                label={t('End Time')}
                disabled={!startTime}
                date={endTime}
                minimumDate={startTime || new Date()}
                onSelect={endTime => this.setState({ endTime }, this.setIsValid)}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.pressSelectionSection, styles.topics]}
            onPress={this.handleShowLocationPicker}
          >
            <View style={styles.pressSelection}>
              <Text style={styles.pressSelectionLeftText}>{t('Location')}</Text>
              <View style={styles.pressSelectionRight}><Icon name='ArrowDown' style={styles.pressSelectionRightIcon} /></View>
            </View>
            {(location || locationObject) && (
              <Text style={styles.pressSelectionValue}>{location || locationObject.fullText}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pressSelectionSection}
            onPress={this.handleShowGroupsEditor}
          >
            <View style={styles.pressSelection}>
              <Text style={styles.pressSelectionLeftText}>{t('Post In')}</Text>
              <View style={styles.pressSelectionRight}><Icon name='Plus' style={styles.pressSelectionRightIcon} /></View>
            </View>
            <GroupsList
              style={[styles.pressSelectionValue]}
              groups={groups}
              columns={1}
              onPress={this.handleShowGroupsEditor}
              onRemove={this.handleRemoveGroup}
              RemoveIcon={() => (
                <Icon name='Ex' style={styles.groupRemoveIcon} />
              )}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pressSelectionSection, styles.topics]}
            onPress={this.handleShowLocationPicker}
          >
            <View style={styles.pressSelection}>
              <Text style={styles.pressSelectionLeft}>{t('Location')}</Text>
              <View style={styles.pressSelectionRight}><Icon name='ArrowDown' style={styles.pressSelectionRightIcon} /></View>
            </View>
            {(location || locationObject) && (
              <Text style={styles.pressSelectionValue}>{location || locationObject.fullText}</Text>
            )}
          </TouchableOpacity>

          {type === 'project' && (
            <View style={[styles.pressSelectionSection, styles.topics]}>
              <View style={styles.pressSelection}>
                <Text style={styles.pressSelectionLeft}>{t('Donation Link')}</Text>
                {/* <View style={styles.pressSelectionRight}><Icon name='ArrowDown' style={styles.pressSelectionRightIcon} /></View> */}
              </View>
              <TextInput
                style={styles.pressSelectionValue}
                onChangeText={this.handleDonationsLink}
                returnKeyType='next'
                autoCapitalize='none'
                value={donationsLink}
                autoCorrect={false}
                underlineColorAndroid='transparent'
              />
            </View>
          )}

          {type === 'project' && (
            <View style={[styles.pressSelectionSection, styles.topics]}>
              <View style={styles.pressSelection}>
                <Text style={styles.pressSelectionLeft}>{t('Project Management')}</Text>
              </View>
              <TextInput
                style={styles.pressSelectionValue}
                onChangeText={this.handleProjectManagementLink}
                returnKeyType='next'
                autoCapitalize='none'
                value={projectManagementLink}
                autoCorrect={false}
                underlineColorAndroid='transparent'
              />
            </View>
          )}
        </View>

        {/*  Form Bottom */}

        <View style={styles.formBottom}>
          <TouchableOpacity
            style={[styles.pressSelectionSection, isPublic && styles.pressSelectionSectionPublicSelected]}
            onPress={this.handleTogglePublicPost}
          >
            <View style={styles.pressSelection}>
              <View style={styles.pressSelectionLeft}>
                <Icon
                  name='Public'
                  style={[{ fontSize: 16, marginRight: 10 }, isPublic && styles.pressSelectionSectionPublicSelected]}
                  color={rhino80}
                />
                <Text style={[styles.pressSelectionLeftText, isPublic && styles.pressSelectionSectionPublicSelected]}>{t('Make Public')}</Text>
              </View>
              <View style={styles.pressSelectionRightNoBorder}>
                <Switch
                  trackColor={{ true: caribbeanGreen, false: rhino80 }}
                  onValueChange={this.handleTogglePublicPost}
                  style={styles.pressSelectionSwitch}
                  value={isPublic}
                />
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pressSelectionSection, announcementEnabled && styles.pressSelectionSectionPublicSelected]}
            onPress={this.handleToggleAnnouncement}
          >
            <View style={styles.pressSelection}>
              <View style={styles.pressSelectionLeft}>
                <Icon
                  name='Announcement'
                  style={[{ fontSize: 16, marginRight: 10 }, announcementEnabled && styles.pressSelectionSectionPublicSelected]}
                  color={rhino80}
                />
                <Text style={[styles.pressSelectionLeftText, announcementEnabled && styles.pressSelectionSectionPublicSelected]}>{t('Announcement?')}</Text>
              </View>
              <View style={styles.pressSelectionRightNoBorder}>
                <Switch
                  trackColor={{ true: caribbeanGreen, false: rhino80 }}
                  onValueChange={this.handleToggleAnnouncement}
                  style={styles.pressSelectionSwitch}
                  value={announcementEnabled}
                />
              </View>
            </View>
            {!isEmpty(files) && (
              <View>
                <FileSelector
                  onRemove={this.handleRemoveAttachmentForKey('files')}
                  files={files}
                />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pressSelectionSection}
          >
            <View style={styles.pressSelection}>
              <View style={styles.pressSelectionLeft}>
                <Icon
                  name='AddImage'
                  style={{ padding: 0, margin: 0, fontSize: 24, marginRight: 5 }}
                  color={rhino80}
                />
                <Text style={styles.pressSelectionLeftText}>{t('Images')}</Text>
              </View>
              <View style={styles.pressSelectionRight}>
                <ImagePicker
                  type='post'
                  id={post?.id}
                  selectionLimit={10}
                  onChoice={this.handleAddAttachmentForKey('images')}
                  onError={this.handleAttachmentUploadErrorForKey('images')}
                  renderPicker={loading => {
                    if (!loading) {
                      return (
                        <Icon name='Plus' style={styles.pressSelectionRightIcon} />
                      )
                    } else {
                      return (
                        <Loading
                          size={30}
                          style={[styles.pressSelectionRightIcon, { padding: 8 }, styles.buttonBarIconLoading]}
                        />
                      )
                    }
                  }}
                />
              </View>
            </View>
            {!isEmpty(images) && (
              <ImageSelector
                onAdd={this.handleAddAttachmentForKey('images')}
                onRemove={this.handleRemoveAttachmentForKey('images')}
                images={images}
                style={[styles.imageSelector]}
                type='post'
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pressSelectionSection}
            onPress={this.handleShowFilePicker}
          >
            <View style={styles.pressSelection}>
              <View style={styles.pressSelectionLeft}>
                <Icon
                  name='Paperclip'
                  style={{ padding: 0, margin: 0, fontSize: 24, marginRight: 5 }}
                  color={rhino80}
                />
                <Text style={styles.pressSelectionLeftText}>{t('Files')}</Text>
              </View>
              <View style={styles.pressSelectionRight}>
                <TouchableOpacity onPress={this.handleShowFilePicker}>
                  {filePickerPending && (
                    <Loading
                      size={30}
                      style={[styles.buttonBarIcon, { padding: 8 }, styles.buttonBarIconLoading]}
                    />
                  )}
                  {!filePickerPending && (
                    <Icon name='Plus' style={styles.pressSelectionRightIcon} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            {!isEmpty(files) && (
              <View>
                <FileSelector
                  onRemove={this.handleRemoveAttachmentForKey('files')}
                  files={files}
                />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  render () {
    return (
      <KeyboardAvoidingView
        style={styles.formWrapper}
        behavior={isIOS ? 'padding' : null}
        keyboardVerticalOffset={isIOS ? 110 : 80}
      >
        <ScrollView
          ref={this.scrollViewRef}
          keyboardShouldPersistTaps='never'
          keyboardDismissMode={isIOS ? 'interactive' : 'on-drag'}
          // Avoids a known issue on Android with overscroll and WebViews
          overScrollMode='never'
        >
          {this.renderForm()}
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }
}

export function TypeSelector (props) {
  const { t } = useTranslation()
  // explicit invocation of dynamic labels
  t('Discussion')
  t('Request')
  t('Offer')
  t('Resource')
  t('Project')
  t('Event')
  return (
    <View style={styles.typeSelectorWrapper}>
      <RNPickerSelect
        {...props}
        style={typeSelectorStyles(props.value)}
        useNativeAndroidPickerStyle={false}
        pickerProps={{ itemStyle: { backgroundColor: white, letterSpacing: 2, fontWeight: 'bold', fontSize: 20 } }}
        items={
          ['Discussion', 'Request', 'Offer', 'Resource', 'Project', 'Event'].map(type => ({
            label: t(type).toUpperCase(),
            value: type.toLowerCase(),
            color: typeSelectorStyles(type.toLowerCase()).inputIOS.color
          }))
        }
        Icon={() => (
          <Icon name='ArrowDown' style={typeSelectorStyles(props.value).icon} />
        )}
      />
    </View>
  )
}

export function DatePickerWithLabel ({
  date,
  minimumDate,
  label,
  onSelect,
  disabled,
  style,
  styleTemplate = {
    disabled: styles.pressDisabled,
    expandIconWrapper: styles.pressSelectionRight,
    expandIcon: styles.pressSelectionRightIcon,
    labelText: styles.pressSelectionLeftText,
    labelWrapper: styles.pressSelection,
    valueText: styles.pressSelectionValue
  },
  dateFormat = 'MM/DD/YYYY LT z'
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const handleOnPress = () => {
    !disabled && setOpen(true)
  }
  const handleOnConfirm = newDate => {
    onSelect(newDate)
    setOpen(false)
  }
  const handleOnCancel = () => {
    onSelect(null)
    setOpen(false)
  }

  return (
    <>
      <TouchableOpacity style={style} onPress={handleOnPress}>
        <View style={styleTemplate.labelWrapper}>
          <Text style={[styleTemplate.labelText, disabled && styleTemplate.disabled]}>
            {label}
          </Text>
          <View style={[styleTemplate.expandIconWrapper, disabled && styleTemplate.disabled]}>
            <Icon name='ArrowDown' style={[styleTemplate.expandIcon, disabled && styleTemplate.disabled]} />
          </View>
        </View>
        {date && !open && (
          <Text style={styleTemplate.valueText}>{moment.tz(date, moment.tz.guess()).format(dateFormat)}</Text>
        )}
      </TouchableOpacity>
      <DatePicker
        modal
        open={open}
        minimumDate={minimumDate}
        minuteInterval={5}
        date={date || new Date()}
        mode='datetime'
        title={label}
        confirmText={t('Set')}
        cancelText={t('Clear')}
        onConfirm={handleOnConfirm}
        onCancel={handleOnCancel}
      />
    </>
  )
}
