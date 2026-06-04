// DEPRECATED: This native screen is no longer used.
// All functionality is now handled by PrimaryWebView displaying the web app.
// Kept for reference only.

/* eslint-disable react/no-unstable-nested-components */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Alert, KeyboardAvoidingView, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useQuery, useMutation } from 'urql'
import { get } from 'lodash/fp'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Validators } from '@hylo/shared'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useHasResponsibility, { RESP_ADMINISTRATION } from '@hylo/hooks/useHasResponsibility'
import useFindOrCreateLocationObject from '@hylo/hooks/useFindOrCreateLocationObject'
import createPostMutation from '@hylo/graphql/mutations/createPostMutation'
import createProjectMutation from '@hylo/graphql/mutations/createProjectMutation'
import updatePostMutation from '@hylo/graphql/mutations/updatePostMutation'
import peopleAutocompleteQuery from '@hylo/graphql/queries/peopleAutocompleteQuery'
import postQuery from '@hylo/graphql/queries/postQuery'
import topicsForGroupIdQuery from '@hylo/graphql/queries/topicsForGroupIdQuery'
import { DEFAULT_POST_TYPE, POST_TYPES } from '@hylo/presenters/PostPresenter'
import { isStaticContext } from '@hylo/presenters/GroupPresenter'
import { isIOS } from 'util/platform'
import useConfirmAlert from 'hooks/useConfirmAlert'
import useRouteParams from 'hooks/useRouteParams'
import uploadAction from 'store/actions/upload'
import { usePostEditorStore } from './PostEditor.store'
// Components
import DatePickerWithLabel from './DatePickerWithLabel'
import TypeSelector from './TypeSelector'
import ItemSelectorModal from 'components/ItemSelectorModal'
import LocationSelectorModal from 'components/LocationSelectorModal'
import TopicRow from 'screens/TopicList/TopicRow'
import GroupsList from 'components/GroupsList'
import Button from 'components/Button'
import FileSelector, { showFilePicker as fileSelectorShowFilePicker } from './FileSelector'
import HyloEditorWebView from 'components/HyloEditorWebView'
import Icon from 'components/Icon'
import ImagePicker from 'components/ImagePicker'
import ImageSelector from './ImageSelector'
import Loading from 'components/Loading'
import LucideIcon from 'components/LucideIcon'
import ProjectMembersSummary from 'components/ProjectMembersSummary'
import Topics from 'components/Topics'
import HeaderLeftCloseIcon from 'navigation/headers/HeaderLeftCloseIcon'
import styles from './PostEditor.styles'
import { caribbeanGreen, rhino30, rhino80 } from '@hylo/presenters/colors'

export const MAX_TITLE_LENGTH = 50

const titlePlaceholders = {
  discussion: 'Add a Title',
  request: 'Add a Request Title',
  offer: 'Add an Offer Title',
  resource: 'Add a Resource Title',
  project: 'Add a Project Title',
  proposal: 'Add a Proposal Title',
  event: 'Add an Event Title',
  submission: 'Add a Title'
}

export const getPostTypeOrDefault = postType => {
  return Object.prototype.hasOwnProperty.call(POST_TYPES, postType) ? postType : DEFAULT_POST_TYPE
}

export default function PostEditor (props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigation = useNavigation()
  const scrollViewRef = useRef(null)
  const detailsEditorRef = useRef(null)
  const [, createNewPost] = useMutation(createPostMutation)
  const [, createNewProject] = useMutation(createProjectMutation)
  const [, updateSelectedPost] = useMutation(updatePostMutation)
  const [, findOrCreateLocation] = useFindOrCreateLocationObject()
  const upload = useCallback((...params) => dispatch(uploadAction(...params)), [dispatch])
  const confirmAlert = useConfirmAlert()

  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  const hasResponsibility = useHasResponsibility({ forCurrentUser: true })
  const {
    id: selectedPostId,
    lat: mapCoordinateLat,
    lng: mapCoordinateLng,
    topicName: selectedTopicName,
    type: providedType,
    fundingRoundId,
    submissionDescriptor,
    groupId: providedGroupId
  } = useRouteParams()

  const {
    post,
    updatePost,
    resetPost,
    isValid,
    preparePostData,
    togglePublicPost,
    toggleAnnouncement,
    addGroup,
    removeGroup,
    updateLocation,
    addTopic,
    removeTopic,
    addAttachment,
    removeAttachment
  } = usePostEditorStore()

  const editingPost = !!selectedPostId
  const isSubmission = !!fundingRoundId || providedType === 'submission' || post.type === 'submission'
  const [{ data: selectedPostData, fetching: selectedPostLoading }] = useQuery({
    query: postQuery, variables: { id: selectedPostId }, pause: !editingPost
  })

  useEffect(() => { resetPost() }, [])

  useEffect(() => {
    const allGroups = currentUser?.memberships?.map(m => m.group) || []
    const groups = providedGroupId
      ? allGroups.filter(g => g.id === providedGroupId)
      : currentGroup && !isStaticContext(currentGroup?.slug) ? [currentGroup] : post.groups

    const postType = fundingRoundId || providedType === 'submission'
      ? 'submission'
      : getPostTypeOrDefault(providedType || post.type)

    updatePost({
      type: postType,
      topics: selectedTopicName ? [{ name: selectedTopicName }] : post.topics,
      groups,
      fundingRoundId
    })
  }, [updatePost, providedType, selectedTopicName, currentGroup, providedGroupId, fundingRoundId, currentUser])

  useEffect(() => {
    if (selectedPostData?.post) {
      updatePost(selectedPostData.post)
    }
  }, [selectedPostData?.post])

  const canAdminister = hasResponsibility(RESP_ADMINISTRATION, {
    groupIds: post?.groups && post.groups.map(group => group.id)
  })
  const canHaveTimeframe = useMemo(() => post.type !== 'discussion', [post])
  const titleLengthWarning = useMemo(() => post?.title && post.title.length >= MAX_TITLE_LENGTH, [post])
  const groupOptions = useMemo(() => currentUser?.memberships.map(m => m.group) || [], [currentUser])
  const mapCoordinate = useMemo(() => {
    return mapCoordinateLat && mapCoordinateLng ? { lat: mapCoordinateLat, lng: mapCoordinateLng } : null
  }, [mapCoordinateLat, mapCoordinateLng])
  const [isSaving, setIsSaving] = useState(false)
  const [topicsPicked, setTopicsPicked] = useState(false)
  const [filePickerPending, setFilePickerPending] = useState(false)
  const saveSuccessfulRef = useRef(false)

  const handleShowFilePicker = async () => {
    setFilePickerPending(true)
    await fileSelectorShowFilePicker({
      upload,
      type: 'post',
      id: post?.id,
      onAdd: attachment => addAttachment('file', attachment),
      onError: (errorMessage, attachment) => {
        setFilePickerPending(true)
        handleAttachmentUploadError('file', errorMessage, attachment)
      },
      onComplete: () => setFilePickerPending(false),
      onCancel: () => setFilePickerPending(false)
    })
  }

  useEffect(() => {
    if (!editingPost && mapCoordinate) {
      findOrCreateLocation({
        fullText: `${mapCoordinate.lat},${mapCoordinate.lng}`,
        center: {
          lat: parseFloat(mapCoordinate.lat),
          lng: parseFloat(mapCoordinate.lng)
        }
      }).then(({ locationObject }) => {
        updateLocation(locationObject)
      })
    }

    const removeBeforeRemove = navigation.addListener('beforeRemove', (e) => {
      if (saveSuccessfulRef.current) {
        return
      }
      e.preventDefault()
      confirmAlert({
        onConfirm: () => navigation.dispatch(e.data.action),
        title: 'Are you sure?',
        confirmMessage: 'If you made changes they will be lost'
      })
    })

    return () => {
      removeBeforeRemove()
    }
  }, [editingPost, mapCoordinate, findOrCreateLocation, navigation, t])

  const handleSave = useCallback(async () => {
    if (!detailsEditorRef?.current) return

    const doSave = async () => {
      setIsSaving(true)

      const postData = preparePostData({
        details: detailsEditorRef.current.getHTML(),
        canHaveTimeframe
      })

      try {
        const saveAction = postData.id ? updateSelectedPost : postData.type === 'project' ? createNewProject : createNewPost
        const { error, data } = await saveAction(postData)

        if (error) {
          console.error(error)
          throw new Error('Error submitting post')
        }

        const id = data[Object.keys(data)[0]].id

        saveSuccessfulRef.current = true

        if (isSubmission) {
          navigation.goBack()
        } else {
          navigation.navigate('Post Details', { id })
        }
      } catch (e) {
        console.log('!!!! error saving post', e)
        setIsSaving(false)
      }
    }

    if (post.announcement) {
      Alert.alert(
        t('makeAnAnnouncement'),
        t('announcementExplainer'),
        [
          { text: t('Send It'), onPress: () => doSave() },
          { text: t('Go Back'), style: 'cancel', onPress: () => {} }
        ]
      )
    } else {
      doSave()
    }
  }, [post, canHaveTimeframe, detailsEditorRef, isSubmission, navigation])

  const header = useMemo(() => {
    const headerRightButtonLabel = isSaving
      ? 'Saving-ellipsis'
      : editingPost
        ? 'Save'
        : 'Post'

    return () => (
      <View className='bg-background border-foreground/30' style={styles.headerContainer}>
        <View style={styles.header}>
          <HeaderLeftCloseIcon
            style={styles.headerCloseIcon}
            color={rhino30}
            onPress={() => navigation.goBack()}
          />
          {isSubmission
            ? (
              <Text className='text-foreground font-bold text-lg flex-1 text-center'>
                {editingPost ? t('Edit {{submissionDescriptor}}', { submissionDescriptor: submissionDescriptor || 'Submission' }) : t('Add {{submissionDescriptor}}', { submissionDescriptor: submissionDescriptor || 'Submission' })}
              </Text>
              )
            : (
              <TypeSelector
                disabled={isSaving || post.type === 'proposal'}
                onValueChange={type => updatePost({ type })}
                placeholder={{}}
                value={post?.type}
              />
              )}
          <Button
            style={styles.headerSaveButton}
            disabled={isSaving || !isValid()}
            onPress={handleSave}
            text={t(headerRightButtonLabel)}
          />
        </View>
      </View>
    )
  }, [isValid, isSaving, handleSave, post?.type, isSubmission, submissionDescriptor, editingPost])

  useEffect(() => {
    navigation.setOptions({ headerShown: true, header })
  }, [header])

  const handleAddTopic = (providedTopic, picked) => {
    const ignoreHash = name => name[0] === '#' ? name.slice(1) : name
    const topic = { ...providedTopic, name: ignoreHash(providedTopic.name) }

    if (Validators.validateTopicName(topic.name) === null) {
      if (picked !== undefined) setTopicsPicked(picked)
      addTopic(topic)
    }
  }

  const handleRemoveTopic = topic => {
    removeTopic(topic)
    setTopicsPicked(true)
  }

  const handleAttachmentUploadError = (type, errorMessage, attachment) => {
    removeAttachment(type, attachment)
    Alert.alert(errorMessage)
  }

  const groupSelectorModalRef = useRef(null)
  const topicSelectorModalRef = useRef(null)
  const locationSelectorModalRef = useRef(null)
  const projectMembersSelectorModalRef = useRef(null)

  if (selectedPostLoading) return null

  return (
    <KeyboardAvoidingView
      className='flex-1 bg-background'
      behavior={isIOS ? 'padding' : null}
      keyboardVerticalOffset={isIOS ? 110 : 80}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[{ paddingBottom: insets.bottom }]}
        keyboardShouldPersistTaps='never'
        keyboardDismissMode={isIOS ? 'interactive' : 'on-drag'}
        // Avoids a known issue on Android with overscroll and WebViews
        overScrollMode='never'
      >
        {selectedPostLoading && <Loading />}
        {!selectedPostLoading && (
          <View>
            {!isSubmission && (
              <TouchableOpacity
                className='border-foreground/30'
                style={styles.pressSelectionSection}
                onPress={() => groupSelectorModalRef.current.show()}
              >
                <View style={styles.pressSelection}>
                  <Text style={styles.pressSelectionLeftText}>{t('To:')}</Text>
                  <View style={styles.pressSelectionRight}>
                    <Icon name='Plus' style={styles.pressSelectionRightIcon} />
                  </View>
                </View>
                <ItemSelectorModal
                  ref={groupSelectorModalRef}
                  title={t('Post in Groups')}
                  items={groupOptions}
                  itemsTransform={(items, searchTerm) => (
                    items.filter(item => searchTerm
                      ? item.name.toLowerCase().match(searchTerm?.toLowerCase())
                      : item
                    )
                  )}
                  chosenItems={post.groups}
                  onItemPress={addGroup}
                  searchPlaceholder={t('Search for group by name')}
                />
                <GroupsList
                  style={styles.pressSelectionValue}
                  groups={post.groups}
                  columns={1}
                  onPress={() => groupSelectorModalRef.current.show()}
                  onRemove={removeGroup}
                  RemoveIcon={() => (
                    <Icon className='text-muted' name='Ex' style={styles.groupRemoveIcon} />
                  )}
                />
              </TouchableOpacity>
            )}

            <View style={[styles.titleInputWrapper]}>
              <TextInput
                className='text-foreground placeholder:text-foreground/50'
                style={[styles.titleInput]}
                editable={!isSaving}
                onChangeText={title => updatePost({ title })}
                placeholder={t(titlePlaceholders[post.type])}
                placeholderTextColor={rhino30}
                underlineColorAndroid='transparent'
                autoCorrect={false}
                value={post.title}
                multiline
                numberOfLines={2}
                blurOnSubmit
                maxLength={MAX_TITLE_LENGTH}
              />
              {titleLengthWarning && (
                <Text className='text-error' style={styles.titleInputError}>😬 {MAX_TITLE_LENGTH} {t('characters max')}</Text>
              )}
            </View>

            <View
              className='border-foreground/30'
              style={[styles.textInputWrapper, styles.detailsInputWrapper]}
            >
              <HyloEditorWebView
                placeholder={t('Add a description')}
                contentHTML={post?.details}
                // groupIds={groupOptions && groupOptions.map(g => g.id)}
                onChange={details => updatePost({ details })}
                onAddTopic={!topicsPicked && handleAddTopic}
                readOnly={selectedPostLoading || isSaving}
                ref={detailsEditorRef}
                widthOffset={-20}
                customEditorCSS={`
                  min-height: 90px;
                `}
              />
            </View>

            {!isSubmission && (
              <TouchableOpacity
                className='border-foreground/30'
                style={[styles.pressSelectionSection, styles.topics]}
                onPress={() => topicSelectorModalRef.current.show()}
              >
                <View style={styles.pressSelection}>
                  <Text className='text-foreground/80' style={styles.pressSelectionLeftText}>{t('Topics')}</Text>
                  <View style={styles.pressSelectionRight}>
                    <Icon className='text-secondary' name='Plus' style={styles.pressSelectionRightIcon} />
                  </View>
                </View>
                <ItemSelectorModal
                  ref={topicSelectorModalRef}
                  title={t('Pick a Topic')}
                  searchPlaceholder={t('Search for a topic by name')}
                  onItemPress={topic => handleAddTopic(topic, true)}
                  itemsUseQueryArgs={({ searchTerm }) => ({
                    query: topicsForGroupIdQuery,
                    variables: {
                      searchTerm,
                      // Note: Only finds topics for first group
                      groupId: get('[0].id', post.groups)
                    }
                  })}
                  itemsUseQuerySelector={data =>
                    data?.group?.groupTopics?.items &&
                    data?.group?.groupTopics?.items.map(item => item.topic)}
                  itemsTransform={(items, searchTerm) => {
                    if (!items.find(item => item.name.match(searchTerm))) {
                      items.unshift({ id: searchTerm, name: searchTerm })
                    }
                    return items
                  }}
                  chosenItems={post.topics}
                  renderItem={TopicRow}
                />
                <Topics
                  className='text-secondary'
                  style={styles.pressSelectionValue}
                  pillStyle={styles.topicPillStyle}
                  textStyle={styles.topicTextStyle}
                  onPress={() => topicSelectorModalRef.current.show()}
                  onPressRemove={handleRemoveTopic}
                  topics={post.topics}
                />
              </TouchableOpacity>
            )}

            {post.type === 'proposal' && (
              <View
                className='border-foreground/30'
                style={styles.pressSelection}
              >
                <Text style={styles.pressSelectionLeftText}>{t('Proposal details can be edited in the web-app')}</Text>
              </View>
            )}

            {post.type === 'project' && (
              <TouchableOpacity
                className='border-foreground/30'
                style={styles.pressSelectionSection}
                onPress={() => projectMembersSelectorModalRef?.current.show()}
              >
                <View style={styles.pressSelection}>
                  <Text style={styles.pressSelectionLeftText}>{t('Project Members')}</Text>
                  <View style={styles.pressSelectionRight}><Icon name='Plus' style={styles.pressSelectionRightIcon} /></View>
                </View>
                <ItemSelectorModal
                  ref={projectMembersSelectorModalRef}
                  itemsUseQueryArgs={({ searchTerm }) => ({
                    query: peopleAutocompleteQuery,
                    variables: { autocomplete: searchTerm }
                  })}
                  itemsUseQuerySelector={data => data?.people?.items}
                  title={t('Project Members')}
                  searchPlaceholder={t('Type in the names of people to add to project')}
                  chooser
                  chosenItems={post?.members?.items || []}
                  onClose={chosenItems => {
                    chosenItems && updatePost({ members: { items: chosenItems } })
                  }}
                />
                {post.members.items.length > 0 && (
                  <ProjectMembersSummary
                    style={styles.pressSelectionValue}
                    members={post.members.items}
                    onPress={() => projectMembersSelectorModalRef?.current.show()}
                  />
                )}
              </TouchableOpacity>
            )}

            {!isSubmission && canHaveTimeframe && (
              <>
                <DatePickerWithLabel
                  className='border-foreground/30'
                  style={styles.pressSelectionSection}
                  label={t('Start Time')}
                  date={post.startTime}
                  minimumDate={new Date()}
                  onSelect={startTime => updatePost({ startTime })}
                />
                <DatePickerWithLabel
                  className='border-foreground/30'
                  style={styles.pressSelectionSection}
                  label={t('End Time')}
                  disabled={!post.startTime}
                  date={post.endTime}
                  minimumDate={post.startTime || new Date()}
                  onSelect={endTime => updatePost({ endTime })}
                />
              </>
            )}

            {!isSubmission && (
              <TouchableOpacity
                className='border-foreground/30'
                style={[styles.pressSelectionSection]}
                onPress={togglePublicPost}
              >
                <View style={styles.pressSelection}>
                  <View style={styles.pressSelectionLeft}>
                    <LucideIcon
                      name='Globe'
                      style={[{ marginRight: 7 }]}
                      size={20}
                      color={rhino80}
                    />
                    <Text style={styles.pressSelectionLeftText}>{t('Make Public')}</Text>
                  </View>
                  <View style={styles.pressSelectionRightNoBorder}>
                    <Switch
                      trackColor={{ true: caribbeanGreen, false: rhino80 }}
                      onValueChange={togglePublicPost}
                      style={styles.pressSelectionSwitch}
                      value={post.isPublic}
                    />
                  </View>
                </View>
                {post.groups?.some(g => g.allowInPublic) && (
                  <Text className='text-foreground/50 text-sm mt-2 px-2 ml-2'>
                    {t('If public this post will be visible in the Commons public feed and map')}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {!isSubmission && (
              <TouchableOpacity
                className='border-foreground/30'
                style={[styles.pressSelectionSection, styles.topics]}
                onPress={() => locationSelectorModalRef.current.show()}
              >
                <View style={styles.pressSelection}>
                  <View style={styles.pressSelectionLeft}>
                    <LucideIcon
                      name='MapPin'
                      style={{ marginRight: 7 }}
                      size={20}
                      color={rhino80}
                    />
                    <Text className='text-foreground/80' style={styles.pressSelectionLeftText}>{t('Location')}</Text>
                  </View>
                  <View style={styles.pressSelectionRightNoBorder}>
                    <View style={styles.pressSelectionRight}>
                      <Icon name='ArrowDown' style={styles.pressSelectionRightIcon} />
                    </View>
                  </View>
                </View>
                {(post.location || post.locationObject) && (
                  <Text className='text-secondary' style={styles.pressSelectionValue}>
                    {post.location || post.locationObject.fullText}
                  </Text>
                )}
                <LocationSelectorModal
                  ref={locationSelectorModalRef}
                  onItemPress={updateLocation}
                  initialSearchTerm={post?.location || post?.locationObject?.fullText}
                />
              </TouchableOpacity>
            )}

            {post.type === 'project' && (
              <>
                <View className='border-foreground/30' style={[styles.pressSelectionSection, styles.topics]}>
                  <View style={styles.pressSelection}>
                    <Text style={styles.pressSelectionLeftText}>{t('Donation Link')}</Text>
                    {/* <View style={styles.pressSelectionRight}><Icon name='ArrowDown' style={styles.pressSelectionRightIcon} /></View> */}
                  </View>
                  <TextInput
                    style={styles.pressSelectionValue}
                    onChangeText={donationsLink => updatePost(({ donationsLink }))}
                    returnKeyType='next'
                    autoCapitalize='none'
                    value={post.donationsLink}
                    autoCorrect={false}
                    underlineColorAndroid='transparent'
                  />
                </View>

                <View className='border-foreground/30' style={[styles.pressSelectionSection, styles.topics]}>
                  <View style={styles.pressSelection}>
                    <Text style={styles.pressSelectionLeftText}>{t('Project Management')}</Text>
                  </View>
                  <TextInput
                    style={styles.pressSelectionValue}
                    onChangeText={projectManagementLink => updatePost(({ projectManagementLink }))}
                    returnKeyType='next'
                    autoCapitalize='none'
                    value={post.projectManagementLink}
                    autoCorrect={false}
                    underlineColorAndroid='transparent'
                  />
                </View>
              </>
            )}
          </View>
        )}

        {/*  Form Bottom */}

        <View style={styles.formBottom}>
          {!isSubmission && canAdminister && (
            <TouchableOpacity
              className='border-foreground/30'
              style={[styles.pressSelectionSection]}
              onPress={toggleAnnouncement}
            >
              <View style={styles.pressSelection}>
                <View style={styles.pressSelectionLeft}>
                  <Icon
                    name='Announcement'
                    style={{ marginLeft: -5, marginRight: 6, fontSize: 28 }}
                    color={rhino80}
                  />
                  <Text style={styles.pressSelectionLeftText}>{t('Announcement?')}</Text>
                </View>
                <View style={styles.pressSelectionRightNoBorder}>
                  <Switch
                    trackColor={{ true: caribbeanGreen, false: rhino80 }}
                    onValueChange={toggleAnnouncement}
                    style={styles.pressSelectionSwitch}
                    value={post?.announcement}
                  />
                </View>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className='border-foreground/30'
            style={styles.pressSelectionSection}
          >
            <View style={styles.pressSelection}>
              <View style={styles.pressSelectionLeft}>
                <Icon
                  name='AddImage'
                  style={{ marginLeft: -5, fontSize: 28, marginRight: 5 }}
                  color={rhino80}
                />
                <Text style={styles.pressSelectionLeftText}>{t('Images')}</Text>
              </View>
              <View style={styles.pressSelectionRight}>
                <ImagePicker
                  type='post'
                  id={post?.id}
                  selectionLimit={10}
                  onChoice={attachment => addAttachment('image', attachment)}
                  onError={(errorMessage, attachment) => handleAttachmentUploadError('image', errorMessage, attachment)}
                  renderPicker={loading => {
                    if (!loading) {
                      return (
                        <Icon name='Plus' style={styles.pressSelectionRightIcon} />
                      )
                    } else {
                      return (
                        <Loading
                          size={30}
                          style={[styles.pressSelectionRightIcon, { padding: 8 }]}
                        />
                      )
                    }
                  }}
                />
              </View>
            </View>
            <ImageSelector
              images={post.getImages()}
              onRemove={attachment => removeAttachment('image', attachment)}
              style={[styles.imageSelector, { padding: 10 }]}
              type='post'
            />
          </TouchableOpacity>

          <TouchableOpacity
            className='border-foreground/30'
            style={styles.pressSelectionSection}
            onPress={handleShowFilePicker}
          >
            <View style={styles.pressSelection}>
              <View style={styles.pressSelectionLeft}>
                <Icon
                  name='Paperclip'
                  style={{ marginLeft: -5, fontSize: 28, marginRight: 5 }}
                  color={rhino80}
                />
                <Text style={styles.pressSelectionLeftText}>{t('Files')}</Text>
              </View>
              <View style={styles.pressSelectionRight}>
                <TouchableOpacity onPress={handleShowFilePicker}>
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
            <FileSelector
              onRemove={attachment => removeAttachment('file', attachment)}
              files={post.getFiles()}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
