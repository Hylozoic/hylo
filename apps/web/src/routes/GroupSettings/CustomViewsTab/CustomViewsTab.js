import { omit } from 'lodash/fp'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation, withTranslation } from 'react-i18next'
import { PlusCircle, Trash2 } from 'lucide-react'

import { cn } from 'util/index'

import Button from 'components/ui/button'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import PostLabel from 'components/PostLabel'
import PostSelector from 'components/PostSelector'
import SaveButton from '../SaveButton'
import SettingsControl from 'components/SettingsControl'
import SettingsSection from '../SettingsSection'
import SwitchStyled from 'components/SwitchStyled'
import TopicSelector from 'components/TopicSelector'
import { useViewHeader } from 'contexts/ViewHeaderContext'

import { POST_TYPES } from 'store/models/Post'
import {
  FETCH_COLLECTION_POSTS,
  FETCH_GROUP_SETTINGS,
  addPostToCollection,
  createCollection,
  fetchCollectionPosts,
  removePostFromCollection,
  reorderPostInCollection,
  updateGroupSettings
} from '../GroupSettings.store'

import { COLLECTION_SORT_OPTIONS, STREAM_SORT_OPTIONS } from 'util/constants'
import { sanitizeURL } from 'util/url'

import styles from './CustomViewsTab.module.scss'

const POST_TYPE_OPTIONS = Object.keys(POST_TYPES).filter(type => type !== 'chat' && type !== 'action')
const emptyCustomView = {
  activePostsOnly: false,
  collectionId: null,
  defaultSort: 'created',
  defaultViewMode: 'cards',
  externalLink: '',
  icon: 'Public',
  isActive: true,
  name: '',
  order: 1,
  postTypes: [],
  topics: [],
  type: 'externalLink'
}

function CustomViewsTab ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const [state, setState] = useState(() => defaultEditState(group))

  function defaultEditState (group) {
    if (!group) return { customViews: [], changed: false }

    const { customViews } = group
    return {
      customViews: customViews || [],
      changed: false,
      postTypesModalOpen: false
    }
  }

  const fetchPending = useSelector(state => state.pending[FETCH_GROUP_SETTINGS])
  const fetchCollectionPostsPending = useSelector(state => state.pending[FETCH_COLLECTION_POSTS])

  const addPostToCollectionAction = useCallback((collectionId, postId) => dispatch(addPostToCollection(collectionId, postId)), [dispatch])
  const createCollectionAction = useCallback((data) => dispatch(createCollection(data)), [dispatch])
  const updateGroupSettingsAction = useCallback(changes => group && dispatch(updateGroupSettings(group.id, changes)), [dispatch, group])
  const removePostFromCollectionAction = useCallback((collectionId, postId) => dispatch(removePostFromCollection(collectionId, postId)), [dispatch])
  const reorderPostInCollectionAction = useCallback((collectionId, postId, newOrderIndex) => dispatch(reorderPostInCollection(collectionId, postId, newOrderIndex)), [dispatch])

  useEffect(() => {
    setState(defaultEditState(group))
  }, [group.id])

  useEffect(() => {
    dispatch(fetchCollectionPosts(group.id))
  }, [group.id])

  useEffect(() => {
    if (fetchPending && !fetchCollectionPostsPending) {
      setState(defaultEditState(group))
    }

    if (fetchCollectionPostsPending && !fetchCollectionPostsPending) {
      // Update collections posts
      const updatedCustomViews = [...state.customViews]
      state.customViews.forEach((cv, i) => {
        if (cv.type === 'collection') {
          const collection = { ...cv.collection }
          collection.posts = group.customViews[i]?.collection?.posts
          updatedCustomViews[i].collection = collection
        }
      })
      setState({ ...state, customViews: updatedCustomViews })
    }
  }, [group])

  const errorString = useMemo(() => {
    let errorString = ''

    state.customViews.forEach(cv => {
      const { externalLink, name, icon } = cv
      if (externalLink?.length > 0) {
        if (!sanitizeURL(externalLink)) {
          errorString += t('External link has to be a valid URL.') + ' \n'
        }
      }

      if (!name || name.length < 2) {
        errorString += t('View name needs to be at least two characters long.') + ' \n'
      }
      if (!icon || icon.length < 1) {
        errorString += t('An icon needs to be selected for the view.') + ' '
      }
    })
    return errorString
  }, [state.customViews])

  const save = async () => {
    setState({ ...state, changed: false })
    const customViews = [...state.customViews].map(cv => {
      cv.topics = cv.topics.map(t => ({ name: t.name, id: t.id }))
      if (cv.externalLink) cv.externalLink = sanitizeURL(cv.externalLink)
      return omit('collection', cv)
    })
    updateGroupSettingsAction({ customViews })
  }

  const addCustomView = () => {
    setState({ ...state, changed: true, customViews: [...state.customViews].concat({ ...emptyCustomView }) })
  }

  const deleteCustomView = (i) => () => {
    if (window.confirm(t('Are you sure you want to delete this custom view?'))) {
      const newViews = [...state.customViews]
      newViews.splice(i, 1)
      setState({ ...state, changed: true, customViews: newViews })
    }
  }

  const updateCustomView = (i) => (key) => async (v) => {
    let value = typeof (v.target) !== 'undefined' ? v.target.value : v
    const cv = { ...state.customViews[i] }

    if (key === 'topics') {
      value = value.map(t => ({ name: t.name, id: parseInt(t.id) }))
    }

    if (key === 'type' && value !== cv.type) {
      if (value === 'collection') {
        if (cv.collection) {
          dispatch(fetchCollectionPosts(group.id))
        } else {
          const resp = await createCollectionAction({ name: cv.name, groupId: group.id })
          cv.collectionId = resp?.payload?.data?.createCollection?.id
        }
      }
      // Streams can't use manual sort order, so revert to created
      if (value === 'stream' && cv.defaultSort === 'order') {
        cv.defaultSort = 'created'
      }
    }

    cv[key] = value
    const customViews = [...state.customViews]
    customViews[i] = cv
    setState({ ...state, changed: true, customViews })
  }

  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    setHeaderDetails({
      title: {
        desktop: `${t('Group Settings')} > ${t('Custom Views')}`,
        mobile: `${t('Custom Views')}`
      },
      icon: 'Eye'
    })
  }, [])

  if (!group) return <Loading />

  const { changed, customViews } = state

  return (
    <div className='mb-[300px]'>
      <h2 className='text-foreground font-bold mb-2'>{t('Custom views unlock new ways to navigate your group')}</h2>
      <p className='text-foreground/70 mb-4'>{t('Create a specific view of your group limited by post type, topic, or sort order, or link to external content. A collection of resources to guide your group, a calendar of events limited to a specific topic, or a list of posts limited to a specific type - the possibilities are endless!')}</p>
      <SettingsSection>
        {customViews.map((cv, i) => (
          <CustomViewRow
            addPostToCollection={addPostToCollectionAction}
            group={group}
            key={i}
            index={i}
            {...cv}
            onChange={updateCustomView(i)}
            onDelete={deleteCustomView(i)}
            removePostFromCollection={removePostFromCollectionAction}
            reorderPostInCollection={reorderPostInCollectionAction}
          />
        ))}
        <Button variant='outline' className='w-full justify-center items-center h-12' onClick={addCustomView}>
          <h4>{t('Create new custom view')}</h4>
          <PlusCircle className='w-6 h-6' />
        </Button>
      </SettingsSection>

      <br />

      <SaveButton
        changed={changed}
        error={errorString}
        save={save}
      />
    </div>
  )
}

export function CustomViewRow ({
  activePostsOnly,
  addPostToCollection,
  collection,
  collectionId,
  defaultSort,
  defaultViewMode,
  externalLink,
  group,
  icon,
  index,
  menuCreate = false,
  name,
  onChange,
  onDelete,
  postTypes,
  removePostFromCollection,
  reorderPostInCollection,
  topics,
  type
}) {
  const [postTypesModalOpen, setPostTypesModalOpen] = useState(false)
  const { t } = useTranslation()
  const VIEW_TYPES = {
    externalLink: t('External Link'),
    stream: t('Post Stream'),
    collection: t('Post Collection')
  }

  const VIEW_MODES = {
    cards: t('Cards'),
    list: t('List'),
    bigGrid: t('Big Grid'),
    grid: t('Small Grid'),
    calendar: t('Calendar')
  }

  const togglePostType = (type, checked) => {
    let newPostTypes = [...postTypes]
    if (checked) {
      newPostTypes = newPostTypes.concat(type)
    } else {
      newPostTypes = newPostTypes.filter(p => p !== type)
    }
    onChange('postTypes')(newPostTypes)
  }

  const removePost = (p) => {
    removePostFromCollection(collectionId, p.id)
  }

  const reorderPost = (p, i) => {
    reorderPostInCollection(collectionId, p.id, i, p)
  }

  const selectPost = (p) => {
    addPostToCollection(collectionId, p.id, p)
  }

  // needed because of external links which have empty default_view_mode or old 'externalLink' value
  const defaultViewModeVal = !defaultViewMode || defaultViewMode === 'externalLink' ? 'cards' : defaultViewMode

  const sortOptions = type === 'collection' ? COLLECTION_SORT_OPTIONS : STREAM_SORT_OPTIONS
  const defaultSortVal = defaultSort || (type === 'collection' ? 'order' : 'created')
  return (
    <div className='bg-card p-2 rounded-md text-foreground mb-4 shadow-xl'>
      {!menuCreate &&
        <h4 className='flex flex-row gap-1'>
          <div className='flex-1'>{name}</div>
          <Trash2 onClick={onDelete} data-testid='delete-custom-view' className='cursor-pointer w-5 h-5' />
        </h4>}
      <div className='flex flex-row gap-1'>
        <SettingsControl label={t('Icon')} controlClass={styles.iconButton} onChange={onChange('icon')} value={icon} type='icon-selector' selectedIconClass={styles.selectedIcon} />
        <SettingsControl label={t('Label')} controlClass={styles.settingsControl} onChange={onChange('name')} value={name} id='custom-view-name' />
        <SettingsControl
          label={t('Type')} controlClass={styles.settingsControl} renderControl={(props) => {
            return (
              <Dropdown
                id='custom-view-type-dropdown'
                className='text-foreground bg-background p-2 rounded-md'
                toggleChildren={
                  <span className='flex flex-row gap-1 items-center'>
                    {VIEW_TYPES[type || 'externalLink']}
                    <Icon name='ArrowDown' />
                  </span>
              }
                items={Object.keys(VIEW_TYPES).map(value => ({
                  label: t(VIEW_TYPES[value]),
                  onClick: () => onChange('type')(value)
                }))}
              />
            )
          }}
        />
      </div>
      {type === 'externalLink'
        ? (
          <div>
            <SettingsControl label={t('External link')} onChange={onChange('externalLink')} value={externalLink || ''} placeholder={t('Will open this URL in a new tab')} />
            {externalLink && !sanitizeURL(externalLink) && <div className={styles.warning}>{t('Must be a valid URL!')}</div>}
          </div>)
        : (
          <div className={styles.customPostsView}>
            <div className={styles.customViewRow}>
              <SettingsControl
                label={t('Default Style')} controlClass={styles.settingsControl} renderControl={(props) => {
                  return (
                    <Dropdown
                      id='custom-view-default-style-dropdown'
                      className={styles.dropdown}
                      toggleChildren={
                        <span className={styles.dropdownLabel}>
                          {VIEW_MODES[defaultViewModeVal || 'cards']}
                          <Icon name='ArrowDown' />
                        </span>
                    }
                      items={Object.keys(VIEW_MODES).map(value => ({
                        label: VIEW_MODES[value],
                        onClick: () => onChange('defaultViewMode')(value)
                      }))}
                    />
                  )
                }}
              />
              <SettingsControl
                label={t('Default Sort')}
                controlClass={styles.settingsControl}
                renderControl={(props) => {
                  return (
                    <Dropdown
                      id='custom-view-default-sort-dropdown'
                      className={styles.dropdown}
                      toggleChildren={
                        <span className={styles.dropdownLabel}>
                          {t(sortOptions.find(o => o.id === defaultSortVal).label)}
                          <Icon name='ArrowDown' />
                        </span>
                      }
                      items={sortOptions.map(({ id, label }) => ({
                        label: t(label),
                        onClick: () => onChange('defaultSort')(id)
                      }))}
                    />
                  )
                }}
              />
            </div>
            {type === 'stream'
              ? (
                <>
                  <div className={cn(styles.postTypes, styles.customViewRow)}>
                    <label className={styles.label}>{t('What post types to display?')}</label>
                    <div className={styles.postTypesChosen}>
                      <span onClick={() => setPostTypesModalOpen(!postTypesModalOpen)}>
                        {postTypes.length === 0 ? t('None') : postTypes.map((p, i) => <PostLabel key={p} type={p} className={styles.postType} />)}
                      </span>
                      <div className={cn(styles.postTypesSelector, { [styles.open]: postTypesModalOpen })}>
                        <Icon name='Ex' className={styles.closeButton} onClick={() => setPostTypesModalOpen(!postTypesModalOpen)} />
                        {POST_TYPE_OPTIONS.map(postType => {
                          const color = POST_TYPES[postType].primaryColor
                          return (
                            <div
                              key={postType}
                              className={styles.postTypeSwitch}
                            >
                              <SwitchStyled
                                backgroundColor={`rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`}
                                name={postType}
                                checked={postTypes.includes(postType)}
                                onChange={(checked, name) => togglePostType(postType, !checked)}
                              />
                              <span>{t(postType)}s</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className={styles.customViewRow}>
                    <label className={cn(styles.label, 'mr-2')}>{t('Include only active posts?')}</label>
                    <SwitchStyled
                      checked={activePostsOnly}
                      onChange={() => onChange('activePostsOnly')(!activePostsOnly)}
                      backgroundColor={activePostsOnly ? '#0DC39F' : '#8B96A4'}
                    />
                  </div>
                  <div className='flex flex-col gap-2 p-4 rounded-md'>
                    <label className='text-foreground/70 text-sm'>{t('Include only posts that match any of these topics:')}</label>
                    <TopicSelector forGroups={[group]} selectedTopics={topics} onChange={onChange('topics')} />
                  </div>
                </>)
              : (
                <>
                  <div className='flex flex-col gap-2 p-4'>
                    <label className='text-foreground/70 text-sm w-full justify-center flex'><span> {collection?.posts?.length || 0} </span> <span>{t('posts in this collection')}</span></label>
                    <PostSelector
                      collection={collection}
                      group={group}
                      draggable={defaultSort === 'order'}
                      onRemovePost={removePost}
                      onReorderPost={reorderPost}
                      onSelectPost={selectPost}
                      posts={collection?.posts}
                    />
                  </div>
                </>
                )}
          </div>
          )}
    </div>
  )
}

export default withTranslation()(CustomViewsTab)
