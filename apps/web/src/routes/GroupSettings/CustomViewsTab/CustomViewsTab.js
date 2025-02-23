import { omit } from 'lodash/fp'
import React, { Component, useState } from 'react'
import { useTranslation, withTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import { cn } from 'util/index'
import Button from 'components/Button'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import PostLabel from 'components/PostLabel'
import PostSelector from 'components/PostSelector'
import SettingsControl from 'components/SettingsControl'
import SwitchStyled from 'components/SwitchStyled'
import TopicSelector from 'components/TopicSelector'
import { POST_TYPES } from 'store/models/Post'
import { COLLECTION_SORT_OPTIONS, STREAM_SORT_OPTIONS } from 'util/constants'
import { sanitizeURL } from 'util/url'
import SettingsSection from '../SettingsSection'

import general from '../GroupSettings.module.scss'
import styles from './CustomViewsTab.module.scss'

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

const { object } = PropTypes

class CustomViewsTab extends Component {
  static propTypes = {
    group: object
  }

  constructor (props) {
    super(props)
    this.state = this.defaultEditState()
  }

  componentDidMount () {
    this.props.fetchCollectionPosts(this.props.group.id)
  }

  componentDidUpdate (prevProps, prevState) {
    if (prevProps.fetchPending && !this.props.fetchPending) {
      this.setState(this.defaultEditState())
    }

    if (prevProps.fetchCollectionPostsPending && !this.props.fetchCollectionPostsPending) {
      // Update collections posts
      const updatedCustomViews = [...this.state.customViews]
      this.state.customViews.forEach((cv, i) => {
        if (cv.type === 'collection') {
          const collection = { ...cv.collection }
          collection.posts = this.props.group.customViews[i]?.collection?.posts
          updatedCustomViews[i].collection = collection
        }
      })
      this.setState({ customViews: updatedCustomViews })
    }
  }

  defaultEditState () {
    const { group } = this.props

    if (!group) return { customViews: [], changed: false, error: null }

    const {
      customViews
    } = group

    return {
      customViews: customViews || [],
      error: null,
      changed: false,
      postTypesModalOpen: false
    }
  }

  validate = () => {
    const { t } = this.props
    const { customViews } = this.state

    let errorString = ''

    customViews.forEach(cv => {
      const { externalLink, name, icon } = cv
      if (externalLink.length > 0) {
        if (!sanitizeURL(externalLink)) {
          errorString += t('External link has to be a valid URL.') + ' \n'
        }
      }

      if (name.length < 2) {
        errorString += t('View name needs to be at least two characters long.') + ' \n'
      }
      if (icon.length < 1) {
        errorString += t('An icon needs to be selected for the view.') + ' '
      }
    })
    this.setState({ error: errorString })
  }

  save = async () => {
    this.setState({ changed: false })
    const customViews = [...this.state.customViews].map(cv => {
      cv.topics = cv.topics.map(t => ({ name: t.name, id: t.id }))
      if (cv.externalLink) cv.externalLink = sanitizeURL(cv.externalLink)
      return omit('collection', cv)
    })
    this.props.updateGroupSettings({ customViews })
  }

  addCustomView = () => {
    this.setState({
      customViews: [...this.state.customViews].concat({ ...emptyCustomView })
    })
  }

  deleteCustomView = (i) => () => {
    if (window.confirm(this.props.t('Are you sure you want to delete this custom view?'))) {
      const newViews = [...this.state.customViews]
      newViews.splice(i, 1)
      this.setState({
        changed: true,
        customViews: newViews
      }, () => {
        this.validate()
      })
    }
  }

  updateCustomView = (i) => (key) => (v) => {
    let value = typeof (v.target) !== 'undefined' ? v.target.value : v
    const cv = { ...this.state.customViews[i] }

    if (key === 'topics') {
      value = value.map(t => ({ name: t.name, id: parseInt(t.id) }))
    }

    if (key === 'type' && value !== cv.type) {
      if (value === 'collection') {
        if (cv.collection) {
          this.props.fetchCollectionPosts(this.props.group.id)
        } else {
          this.props.createCollection({ name: cv.name, groupId: this.props.group.id }).then((resp) => {
            this.updateCustomView(i)('collectionId')(resp?.payload?.data?.createCollection?.id)
          })
        }
      }
      // Streams can't use manual sort order, so revert to created
      if (value === 'stream' && cv.defaultSort === 'order') {
        cv.defaultSort = 'created'
      }
    }

    cv[key] = value
    const customViews = [...this.state.customViews]
    customViews[i] = cv
    this.setState({ changed: true, customViews }, () => {
      this.validate()
    })
  }

  saveButtonContent () {
    const { changed, error } = this.state
    if (!changed) return { color: 'gray', style: '', text: this.props.t('Current settings up to date') }
    if (error) {
      return { color: 'purple', style: 'general.settingIncorrect', text: error }
    }
    return { color: 'green', style: 'general.settingChanged', text: this.props.t('Changes not saved') }
  }

  render () {
    const { addPostToCollection, group, removePostFromCollection, reorderPostInCollection, t } = this.props
    if (!group) return <Loading />

    const { changed, customViews, error } = this.state

    return (
      <div className={general.groupSettings}>
        <SettingsSection>
          <h3>{t('Custom Views')}</h3>
          <div className={styles.helpText}>{t('Add custom links or filtered post views to your group\'s navigation')}</div>
          {customViews.map((cv, i) => (
            <CustomViewRow
              addPostToCollection={addPostToCollection}
              group={group}
              key={i}
              index={i}
              {...cv}
              onChange={this.updateCustomView(i)}
              onDelete={this.deleteCustomView(i)}
              removePostFromCollection={removePostFromCollection}
              reorderPostInCollection={reorderPostInCollection}
            />
          ))}
          <div className={styles.addCustomView} onClick={this.addCustomView}>
            <h4>{t('Create new custom view')}</h4>
            <Icon name='Circle-Plus' className={styles.newCustomView} />
          </div>
        </SettingsSection>

        <br />

        <div className={general.saveChanges}>
          <span className={this.saveButtonContent().style}>{this.saveButtonContent().text}</span>
          <Button label={t('Save Changes')} color={this.saveButtonContent().color} onClick={changed && !error ? this.save : null} className={cn('saveButton', general.saveButton)} />
        </div>
      </div>
    )
  }
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
  const viewCount = parseInt(index) + 1
  return (
    <div className={styles.customViewContainer}>
      {!menuCreate &&
        <h4>
          <div><strong>{t('Custom View')}{' '}#{viewCount}</strong>{' '}{name}</div>
          <Icon name='Trash' onClick={onDelete} dataTestId='delete-custom-view' />
        </h4>}
      <div className={styles.customViewRow}>
        <SettingsControl label={t('Icon')} controlClass={styles.iconButton} onChange={onChange('icon')} value={icon} type='icon-selector' selectedIconClass={styles.selectedIcon} />
        <SettingsControl label={t('Label')} controlClass={styles.settingsControl} onChange={onChange('name')} value={name} id='custom-view-name' />
        <SettingsControl
          label={t('Type')} controlClass={styles.settingsControl} renderControl={(props) => {
            return (
              <Dropdown
                className={styles.dropdown}
                toggleChildren={
                  <span className={styles.dropdownLabel}>
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
                        {Object.keys(POST_TYPES).map(postType => {
                          if (postType === 'chat') {
                            return null
                          }
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
                    <label className={styles.label}>{t('Include only active posts?')}</label>
                    <SwitchStyled
                      checked={activePostsOnly}
                      onChange={() => onChange('activePostsOnly')(!activePostsOnly)}
                      backgroundColor={activePostsOnly ? '#0DC39F' : '#8B96A4'}
                    />
                  </div>
                  <div className={styles.customViewLastRow}>
                    <label className={styles.label}>{t('Include only posts that match any of these topics:')}</label>
                    <TopicSelector currentGroup={group} selectedTopics={topics} onChange={onChange('topics')} />
                  </div>
                </>)
              : (
                <>
                  <div className={styles.postTypes}>
                    <label className={styles.label}>{t('Included Posts')}<span>{collection?.posts?.length || 0}</span> </label>
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
