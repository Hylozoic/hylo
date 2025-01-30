/* eslint-disable react/no-unstable-nested-components */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
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
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useQuery, useMutation } from 'urql'
import { get, uniqBy, isEmpty } from 'lodash/fp'
import { useNavigation } from '@react-navigation/native'
import { Validators, TextHelpers } from '@hylo/shared'
import { isIOS } from 'util/platform'
import useRouteParams from 'hooks/useRouteParams'
import useCurrentUser from 'frontend-shared/hooks/useCurrentUser'
import useCurrentGroup from 'frontend-shared/hooks/useCurrentGroup'
import useHasResponsibility, { RESP_ADMINISTRATION } from 'frontend-shared/hooks/useHasResponsibility'
import useFindOrCreateLocationObject from 'components/LocationSelectorModal/useFindOrCreateLocationObject'
import createPostMutation from 'frontend-shared/graphql/mutations/createPostMutation'
import createProjectMutation from 'frontend-shared/graphql/mutations/createProjectMutation'
import updatePostMutation from 'frontend-shared/graphql/mutations/updatePostMutation'
import uploadAction from 'store/actions/upload'
import postQuery from 'frontend-shared/graphql/queries/postQuery'
import PostPresenter from 'frontend-shared/presenters/PostPresenter'
// Components
import DatePickerWithLabel from './DatePickerWithLabel'
import TypeSelector from './TypeSelector'
import ItemSelectorModal from 'components/ItemSelectorModal'
import LocationSelectorModal from 'components/LocationSelectorModal'
import TopicRow from 'screens/TopicList/TopicRow'
// ProjectMembers Chooser
import peopleAutocompleteQuery from 'frontend-shared/graphql/queries/peopleAutocompleteQuery'
// Topics Picker
import topicsForGroupIdQuery from 'frontend-shared/graphql/queries/topicsForGroupIdQuery'
import GroupsList from 'components/GroupsList'
import Button from 'components/Button'
import FileSelector, { showFilePicker as fileSelectorShowFilePicker } from './FileSelector'
import HyloEditorWebView from 'components/HyloEditorWebView'
import Icon from 'components/Icon'
import ImagePicker from 'components/ImagePicker'
import ImageSelector from './ImageSelector'
import Loading from 'components/Loading'
import ProjectMembersSummary from 'components/ProjectMembersSummary'
import Topics from 'components/Topics'
import HeaderLeftCloseIcon from 'navigation/headers/HeaderLeftCloseIcon'
import confirmDiscardChanges from 'util/confirmDiscardChanges'
import { caribbeanGreen, rhino30, rhino80 } from 'style/colors'
import styles from './PostEditor.styles'

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

export default function PostEditor (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigation = useNavigation()
  const scrollViewRef = useRef(null)
  const detailsEditorRef = useRef(null)
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  const hasResponsibility = useHasResponsibility({ forCurrentUser: true })

  const {
    id: selectedPostId,
    lat: mapCoordinateLat,
    lng: mapCoordinateLng,
    topicName: selectedTopicName,
    type: providedType
  } = useRouteParams()
  const [editingPost] = useState(selectedPostId)
  const [{
    data: selectedPostData,
    fetching: selectedPostLoading
  }] = useQuery({ query: postQuery, variables: { id: selectedPostId }, pause: !editingPost })
  const [post, setPost] = useState({
    type: providedType || 'discussion',
    title: null,
    details: null,
    topics: selectedTopicName ? [{ name: selectedTopicName }] : [],
    members: { items: [] },
    startTime: null,
    endTime: null,
    groups: currentGroup ? [currentGroup] : [],
    location: null,
    locationObject: null,
    donationsLink: null,
    projectManagementLink: null,
    isPublic: false,
    announcement: false,
    attachments: [],
    images: [],
    files: [],
    postMemberships: []
  })
  const canAdminister = hasResponsibility(RESP_ADMINISTRATION, {
    groupIds: post?.groups && post.groups.map(group => group.id)
  })

  const updatePost = useCallback(postUpdates => setPost(prevPost => {
    prevPost.announcement = !canAdminister && prevPost.announcement
    const newPost = PostPresenter(({ ...prevPost, ...postUpdates }))
    return newPost
  }), [setPost, canAdminister])

  // Actions
  const [, createNewPost] = useMutation(createPostMutation)
  const [, createNewProject] = useMutation(createProjectMutation)
  const [, updateSelectedPost] = useMutation(updatePostMutation)
  const [, findOrCreateLocation] = useFindOrCreateLocationObject()
  const upload = useCallback(params => dispatch(uploadAction(params)), [dispatch])
  const canHaveTimeframe = useMemo(() => post.type !== 'discussion', [post])

  // UI State
  const isValid = useMemo(() => {
    const { type, title, groups, startTime, endTime, donationsLink, projectManagementLink } = post
    const attachmentsLoading = post.attachments.some(attachment => !attachment?.url)
    return title && title.length >= 1 &&
      !attachmentsLoading &&
      !isEmpty(groups) &&
      (type !== 'event' || (startTime && endTime)) &&
      (!donationsLink || TextHelpers.sanitizeURL(donationsLink)) &&
      (!projectManagementLink || TextHelpers.sanitizeURL(projectManagementLink))
  }, [post])
  const titleLengthWarning = useMemo(() => post?.title && post.title.length >= MAX_TITLE_LENGTH, [post])
  const groupOptions = useMemo(() => currentUser?.memberships.map(m => m.group) || [], [currentUser])
  const mapCoordinate = useMemo(() => {
    return mapCoordinateLat && mapCoordinateLng ? { lat: mapCoordinateLat, lng: mapCoordinateLng } : null
  }, [mapCoordinateLat, mapCoordinateLng])
  const [isSaving, setIsSaving] = useState(false)
  const [topicsPicked, setTopicsPicked] = useState(false)
  const [filePickerPending, setFilePickerPending] = useState(false)

  const handleShowFilePicker = async () => {
    setFilePickerPending(true)
    await fileSelectorShowFilePicker({
      upload,
      type: 'post',
      id: post?.id,
      onAdd: attachment => handleAddAttachment('file', attachment),
      onError: (errorMessage, attachment) => {
        setFilePickerPending(true)
        handleAttachmentUploadError('file', errorMessage, attachment)
      },
      onComplete: () => setFilePickerPending(false),
      onCancel: () => setFilePickerPending(false)
    })
  }

  useEffect(() => {
    if (selectedPostData?.post) {
      setPost(PostPresenter(selectedPostData.post))
    }
  }, [selectedPostData?.post])

  useEffect(() => {
    if (!editingPost && mapCoordinate) {
      findOrCreateLocation({
        fullText: `${mapCoordinate.lat},${mapCoordinate.lng}`,
        center: {
          lat: parseFloat(mapCoordinate.lat),
          lng: parseFloat(mapCoordinate.lng),
        }
      }).then(({ locationObject }) => {
        handleUpdateLocation(locationObject)
      })
    }

    const removeBeforeRemove = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault()
      confirmDiscardChanges({
        onDiscard: () => navigation.dispatch(e.data.action),
        title: t('Are you sure?'),
        confirmationMessage: t('If you made changes they will be lost'),
        t
      })
    })

    return () => {
      removeBeforeRemove()
    }
  }, [editingPost, mapCoordinate, findOrCreateLocation, navigation, t])

  const handleSave = useCallback(async () => {
    if (!detailsEditorRef?.current) {
      return
    }

    const doSave = async () => {
      setIsSaving(true)

      const postData = {
        id: post.id,
        type: post.type,
        details: detailsEditorRef.current.getHTML(),
        groups: post.groups,
        groupIds: post.groups.map(c => c.id),
        memberIds: post.members.items.map(m => m.id),
        fileUrls: post.filesUrls,
        imageUrls: post.imageUrls,
        isPublic: post.isPublic,
        title: post.title,
        sendAnnouncement: post.announcement,
        topicNames: post.topics.map(t => t.name),
        startTime: !canHaveTimeframe ? null : post.startTime && post.startTime.getTime().valueOf(),
        endTime: !canHaveTimeframe ? null : post.endTime && post.endTime.getTime().valueOf(),
        location: post.location,
        projectManagementLink: TextHelpers.sanitizeURL(post.projectManagementLink),
        donationsLink: TextHelpers.sanitizeURL(post.donationsLink),
        locationId: post?.locationObject?.id || null,
        linkPreviewId: post?.linkPreview && post?.linkPreview.id,
        linkPreviewFeatured: post?.linkPreviewFeatured
      }

      try {
        const saveAction = postData.id ? updateSelectedPost : postData.type === 'project' ? createNewProject : createNewPost
        const { error, data } = await saveAction(postData)

        if (error) {
          console.error(error)
          throw new Error('Error submitting post')
        }

        const id = data[Object.keys(data)[0]].id

        navigation.navigate('Post Details', { id })
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
  }, [post, detailsEditorRef])

  const header = useMemo(() => {
    const headerRightButtonLabel = isSaving
      ? t('Saving-ellipsis')
      : editingPost
        ? t('Save')
        : t('Post')

    return () => (
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <HeaderLeftCloseIcon
            style={styles.headerCloseIcon}
            color={rhino30}
            onPress={() => navigation.goBack()}
          />
          <TypeSelector
            disabled={isSaving || post.type === 'proposal'}
            onValueChange={type => updatePost({ type })}
            placeholder={{}}
            value={post?.type || 'discussion'}
          />
          <Button
            style={styles.headerSaveButton}
            disabled={isSaving || !isValid}
            onPress={handleSave}
            text={headerRightButtonLabel}
          />
        </View>
      </View>
    )
  }, [isValid, isSaving, handleSave, post?.type])

  useEffect(() => {
    navigation.setOptions({ headerShown: true, header })
  }, [header])

  const handleTogglePublicPost = () => {
    updatePost({ isPublic: !post.isPublic })
  }

  const handleToggleAnnouncement = () => {
    updatePost({ announcement: !post.announcement })
  }

  const handleAddGroup = group => {
    updatePost({
      groups: uniqBy(c => c.id, [...post.groups, group])
    })
  }

  const handleRemoveGroup = groupSlug => {
    updatePost({
      groups: post.groups.filter(group => group.slug !== groupSlug)
    })
  }

  const handleUpdateLocation = locationObject => {
    updatePost({
      location: locationObject.fullText,
      locationObject: locationObject?.id !== 'NEW' ? locationObject : null
    })
  }

  const handleAddTopic = (providedTopic, picked) => {
    const ignoreHash = name => name[0] === '#' ? name.slice(1) : name
    const topic = { ...providedTopic, name: ignoreHash(providedTopic.name) }

    if (Validators.validateTopicName(topic.name) === null) {
      if (picked !== undefined) setTopicsPicked(picked)
      console.log(uniqBy((t) => t.name, [...post.topics, topic]).slice(0, 3))
      updatePost({ topics: uniqBy((t) => t.name, [...post.topics, topic]).slice(0, 3) })
    }
  }

  const handleRemoveTopic = topic => {
    updatePost({ topics: post.topics.filter(t => t.id !== topic.id) })
    setTopicsPicked(true)
  }

  const handleAddAttachment = (type, attachment) => {
    updatePost({ attachments: [...post.attachments, { type, url: attachment.remote, ...attachment }] })
  }

  const handleRemoveAttachment = (type, attachmentToRemove) => {
    updatePost({
      attachments: post.attachments.filter(attachment =>
        !(attachment.local === attachmentToRemove.local && attachment.type === type)
      )
    })
  }

  const handleAttachmentUploadError = (type, errorMessage, attachment) => {
    handleRemoveAttachment(type, attachment)
    Alert.alert(errorMessage)
  }

  const groupSelectorModalRef = useRef(null)
  const topicSelectorModalRef = useRef(null)
  const locationSelectorModalRef = useRef(null)
  const projectMembersSelectorModalRef = useRef(null)

  const renderForm = () => {
    return (
      <View style={styles.formContainer}>

        {/*  Form Top */}

        <View style={styles.formTop}>
          <View style={[styles.titleInputWrapper]}>
            <TextInput
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
              <Text style={styles.titleInputError}>😬 {MAX_TITLE_LENGTH} {t('characters max')}</Text>
            )}
          </View>

          <View style={[styles.textInputWrapper, styles.detailsInputWrapper]}>
            <HyloEditorWebView
              placeholder={t('Add a description')}
              contentHTML={post?.details}
              // groupIds={groupOptions && groupOptions.map(g => g.id)}
              onChange={details => updatePost({ details })}
              onAddTopic={!topicsPicked && handleAddTopic}
              readOnly={selectedPostLoading || isSaving}
              ref={detailsEditorRef}
              widthOffset={0}
              customEditorCSS={`
                min-height: 90px
              `}
            />
          </View>

          <TouchableOpacity
            style={[styles.pressSelectionSection, styles.topics]}
            onPress={() => topicSelectorModalRef.current.show()}
          >
            <View style={styles.pressSelection}>
              <Text style={styles.pressSelectionLeftText}>{t('Topics')}</Text>
              <View style={styles.pressSelectionRight}><Icon name='Plus' style={styles.pressSelectionRightIcon} /></View>
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
              renderItem={TopicRow}
            />
            <Topics
              style={styles.pressSelectionValue}
              pillStyle={styles.topicPillStyle}
              textStyle={styles.topicTextStyle}
              onPress={() => topicSelectorModalRef.current.show()}
              onPressRemove={handleRemoveTopic}
              topics={post.topics}
            />
          </TouchableOpacity>

          {post.type === 'proposal' && (
            <View style={styles.pressSelection}>
              <Text style={styles.pressSelectionLeftText}>{t('Proposal details can be edited in the web-app')}</Text>
            </View>
          )}

          {post.type === 'project' && (
            <TouchableOpacity style={styles.pressSelectionSection} onPress={() => projectMembersSelectorModalRef?.current.show()}>
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

          {canHaveTimeframe && (
            <>
              <DatePickerWithLabel
                style={styles.pressSelectionSection}
                label={t('Start Time')}
                date={post.startTime}
                minimumDate={new Date()}
                onSelect={startTime => updatePost({ startTime })}
              />
              <DatePickerWithLabel
                style={styles.pressSelectionSection}
                label={t('End Time')}
                disabled={!post.startTime}
                date={post.endTime}
                minimumDate={post.startTime || new Date()}
                onSelect={endTime => updatePost({ endTime })}
              />
            </>
          )}

          <TouchableOpacity
            style={styles.pressSelectionSection}
            onPress={() => groupSelectorModalRef.current.show()}
          >
            <View style={styles.pressSelection}>
              <Text style={styles.pressSelectionLeftText}>{t('Post In')}</Text>
              <View style={styles.pressSelectionRight}><Icon name='Plus' style={styles.pressSelectionRightIcon} /></View>
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
              onItemPress={handleAddGroup}
              searchPlaceholder={t('Search for group by name')}
            />
            <GroupsList
              style={[styles.pressSelectionValue]}
              groups={post.groups}
              columns={1}
              onPress={() => groupSelectorModalRef.current.show()}
              onRemove={handleRemoveGroup}
              RemoveIcon={() => (
                <Icon name='Ex' style={styles.groupRemoveIcon} />
              )}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pressSelectionSection, styles.topics]}
            onPress={() => locationSelectorModalRef.current.show()}
          >
            <LocationSelectorModal
              ref={locationSelectorModalRef}
              onItemPress={handleUpdateLocation}
              initialSearchTerm={post?.location || post?.locationObject?.fullText}
            />
            <View style={styles.pressSelection}>
              <Text style={styles.pressSelectionLeftText}>{t('Location')}</Text>
              <View style={styles.pressSelectionRight}><Icon name='ArrowDown' style={styles.pressSelectionRightIcon} /></View>
            </View>
            {(post.location || post.locationObject) && (
              <Text style={styles.pressSelectionValue}>{post.location || post.locationObject.fullText}</Text>
            )}
          </TouchableOpacity>

          {post.type === 'project' && (
            <>
              <View style={[styles.pressSelectionSection, styles.topics]}>
                <View style={styles.pressSelection}>
                  <Text style={styles.pressSelectionLeft}>{t('Donation Link')}</Text>
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

              <View style={[styles.pressSelectionSection, styles.topics]}>
                <View style={styles.pressSelection}>
                  <Text style={styles.pressSelectionLeft}>{t('Project Management')}</Text>
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

        {/*  Form Bottom */}

        <View style={styles.formBottom}>
          <TouchableOpacity
            style={[styles.pressSelectionSection, post.isPublic && styles.pressSelectionSectionPublicSelected]}
            onPress={handleTogglePublicPost}
          >
            <View style={styles.pressSelection}>
              <View style={styles.pressSelectionLeft}>
                <Icon
                  name='Public'
                  style={[{ fontSize: 16, marginRight: 10 }, post.isPublic && styles.pressSelectionSectionPublicSelected]}
                  color={rhino80}
                />
                <Text style={[styles.pressSelectionLeftText, post.isPublic && styles.pressSelectionSectionPublicSelected]}>{t('Make Public')}</Text>
              </View>
              <View style={styles.pressSelectionRightNoBorder}>
                <Switch
                  trackColor={{ true: caribbeanGreen, false: rhino80 }}
                  onValueChange={handleTogglePublicPost}
                  style={styles.pressSelectionSwitch}
                  value={post.isPublic}
                />
              </View>
            </View>
          </TouchableOpacity>

          {canAdminister && (
            <TouchableOpacity
              style={[styles.pressSelectionSection, post?.announcement && styles.pressSelectionSectionPublicSelected]}
              onPress={handleToggleAnnouncement}
            >
              <View style={styles.pressSelection}>
                <View style={styles.pressSelectionLeft}>
                  <Icon
                    name='Announcement'
                    style={[{ fontSize: 16, marginRight: 10 }, post?.announcement && styles.pressSelectionSectionPublicSelected]}
                    color={rhino80}
                  />
                  <Text style={[styles.pressSelectionLeftText, post?.announcement && styles.pressSelectionSectionPublicSelected]}>{t('Announcement?')}</Text>
                </View>
                <View style={styles.pressSelectionRightNoBorder}>
                  <Switch
                    trackColor={{ true: caribbeanGreen, false: rhino80 }}
                    onValueChange={handleToggleAnnouncement}
                    style={styles.pressSelectionSwitch}
                    value={post?.announcement}
                  />
                </View>
              </View>
            </TouchableOpacity>
          )}

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
                  onChoice={attachment => handleAddAttachment('image', attachment)}
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
                          style={[styles.pressSelectionRightIcon, { padding: 8 }, styles.buttonBarIconLoading]}
                        />
                      )
                    }
                  }}
                />
              </View>
            </View>
            <ImageSelector
              images={post.images}
              onRemove={attachment => handleRemoveAttachment('image', attachment)}
              style={[styles.imageSelector]}
              type='post'
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pressSelectionSection}
            onPress={handleShowFilePicker}
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
              onRemove={attachment => handleRemoveAttachment('file', attachment)}
              files={post.files}
            />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.formWrapper}
      behavior={isIOS ? 'padding' : null}
      keyboardVerticalOffset={isIOS ? 110 : 80}
    >
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps='never'
        keyboardDismissMode={isIOS ? 'interactive' : 'on-drag'}
        // Avoids a known issue on Android with overscroll and WebViews
        overScrollMode='never'
      >
        {selectedPostLoading ? <Loading /> : renderForm()}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
