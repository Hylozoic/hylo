import { find, get } from 'lodash/fp'
import { object } from 'prop-types'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import debounced from 'util/debounced'
import isPendingFor from 'store/selectors/isPendingFor'
import fetchTopics, { fetchDefaultTopics } from 'store/actions/fetchTopics'
import { FETCH_TOPICS } from 'store/constants'
import {
  setSort,
  setSearch,
  getDefaultTopics,
  getTopics,
  getHasMoreTopics,
  getTotalTopics,
  getSort,
  getSearch,
  setGroupTopicVisibility,
  setGroupTopicIsDefault
} from './TopicsSettingsTab.store'
import { createTopic } from 'components/CreateTopic/CreateTopic.store'
import CreateTopic from 'components/CreateTopic'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import SingleTopicSelector from 'components/TopicSelector/SingleTopicSelector'
import ScrollListener from 'components/ScrollListener'
import TextInput from 'components/TextInput'
import { TOPIC_VISIBILITY } from 'store/models/Topic'
import { cn, inflectedTotal } from 'util/index'
import styles from './TopicsSettingsTab.module.scss'

const sortOptions = [
  { id: 'name', label: 'Name' },
  { id: 'followersTotal', label: 'Popular' }
]

const visibilityOptions = Object.keys(TOPIC_VISIBILITY).reduce((result, option) => result.concat({ value: option, label: TOPIC_VISIBILITY[option] }), [])

const TOPIC_LIST_ID = 'topic-list'

function TopicsSettingsTab ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const selectedSort = useSelector(getSort)
  const search = useSelector(getSearch)

  const fetchTopicsParams = useMemo(() => ({
    group,
    groupSlug: group.slug,
    sortBy: selectedSort,
    autocomplete: search
  }), [group, selectedSort, search])

  const topics = useSelector(state => getTopics(state, fetchTopicsParams))
  const hasMore = useSelector(state => getHasMoreTopics(state, fetchTopicsParams))
  const totalTopics = useSelector(state => getTotalTopics(state, fetchTopicsParams))
  const fetchIsPending = useSelector(state => isPendingFor(FETCH_TOPICS, state))
  const defaultTopics = useSelector(state => getDefaultTopics(state, fetchTopicsParams))

  const [totalTopicsCached, setTotalTopicsCached] = useState(undefined)

  const fetchTopicsDispatched = useCallback((vars) => dispatch(fetchTopics(vars)), [dispatch])
  const fetchDefaultTopicsDispatched = useCallback(() => dispatch(fetchDefaultTopics({ ...fetchTopicsParams })), [dispatch, fetchTopicsParams])

  const fetchTopicsBound = useCallback(() => {
    debounced(fetchTopicsDispatched, {
      ...fetchTopicsParams,
      first: 20
    })
  }, [fetchTopicsDispatched, fetchTopicsParams])

  const fetchMoreTopics = useCallback(() => {
    if (!fetchIsPending && hasMore) {
      debounced(fetchTopicsDispatched, {
        ...fetchTopicsParams,
        offset: get('length', topics, 0),
        first: 10
      })
    }
  }, [fetchTopicsDispatched, fetchTopicsParams, fetchIsPending, hasMore, topics])

  const setSortBound = useCallback((id) => dispatch(setSort(id)), [dispatch])
  const setSearchBound = useCallback((s) => dispatch(setSearch(s)), [dispatch])
  const setGroupTopicVisibilityBound = useCallback((a, b) => dispatch(setGroupTopicVisibility(a, b)), [dispatch])
  const setGroupTopicIsDefaultBound = useCallback((a, b) => dispatch(setGroupTopicIsDefault(a, b)), [dispatch])
  const createTopicBound = useCallback((a, b, c, d) => dispatch(createTopic(a, b, c, d)), [dispatch])

  useEffect(() => {
    fetchTopicsBound()
    fetchDefaultTopicsDispatched()
  }, [group.slug, fetchTopicsBound, fetchDefaultTopicsDispatched])

  const skipSortSearchEffect = useRef(true)
  useEffect(() => {
    if (skipSortSearchEffect.current) {
      skipSortSearchEffect.current = false
      return
    }
    fetchTopicsBound()
  }, [selectedSort, search, fetchTopicsBound])

  useEffect(() => {
    if (!totalTopicsCached && totalTopics) {
      setTotalTopicsCached(totalTopics)
    }
  }, [totalTopics, totalTopicsCached])

  const setGroupTopicVisibilityHandler = useCallback((groupTopicId, value) => (e) => {
    e.preventDefault()
    setGroupTopicVisibilityBound(groupTopicId, value)
  }, [setGroupTopicVisibilityBound])

  const removeSuggestedTopic = useCallback((groupTopicId) => (e) => {
    e.preventDefault()
    setGroupTopicIsDefaultBound(groupTopicId, false)
  }, [setGroupTopicIsDefaultBound])

  return (
    <div className={styles.wrapper}>
      <div className={styles.defaultTopics}>
        <div className={styles.title}>{t('Group Suggested Topics')}</div>
        <p>
          {t(`Set default topics for your group which will be suggested first when
            members are creating a new post.
            Every new member will also be subscribed to these topics when they join.`)}
        </p>
        <div className={styles.defaultTopicList}>
          {defaultTopics.map(topic =>
            <TopicListItem
              key={topic.id}
              singleGroup={group}
              topic={topic}
              setGroupTopicVisibility={setGroupTopicVisibilityHandler}
              removeSuggestedTopic={removeSuggestedTopic}
              isSuggested
            />
          )}
          <div className={styles.defaultTopicSelector}>
            <SingleTopicSelector
              currentGroup={group}
              placeholder={t('Add a suggested topic')}
              onSelectTopic={(topic) => {
                topic && createTopicBound(topic.name, group.id, true, false)
              }}
            />
          </div>
        </div>
      </div>
      <div className={styles.allTopics}>
        <div className={styles.title}>{t('Topic List Editor')}</div>
        <p>
          {t(`Below is a list of every topic that any member of your group has used to date. You can choose to hide
            topics that you would prefer members of your group don't use, or pin topics to the top of the list
            to make sure people pay attention to posts in those topics.`)}
        </p>
        <div className={styles.controls}>
          <SearchBar {...{ search, setSearch: setSearchBound, selectedSort, setSort: setSortBound, fetchIsPending, totalTopicsCached }} />
          <CreateTopic
            buttonText={t('Add a Topic')}
            groupId={group.id}
            groupSlug={group.slug}
            topics={topics}
          />
        </div>
        <div className={styles.topicList} id={TOPIC_LIST_ID}>
          {topics.map(topic =>
            <TopicListItem
              key={topic.id}
              singleGroup={group}
              topic={topic}
              setGroupTopicVisibility={setGroupTopicVisibilityHandler}
            />
          )}
          <ScrollListener onBottom={() => fetchMoreTopics()} elementId={TOPIC_LIST_ID} />
        </div>
      </div>
    </div>
  )
}

TopicsSettingsTab.propTypes = {
  group: object.isRequired
}

export function SearchBar ({ search, setSearch, selectedSort, setSort, fetchIsPending, totalTopicsCached }) {
  const { t } = useTranslation()
  let selected = find(o => o.id === selectedSort, sortOptions)

  if (!selected) selected = sortOptions[0]

  return (
    <div className={styles.searchBar}>
      <TextInput
        className={styles.searchInput}
        value={search}
        placeholder={t('Search {{count}} topics', { count: totalTopicsCached || '' })}
        loading={fetchIsPending}
        noClearButton
        onChange={event => setSearch(event.target.value)}
      />
      <Dropdown
        id='topics-settings-search-order-dropdown'
        className={styles.searchOrder}
        toggleChildren={(
          <span className={styles.searchSorterLabel}>
            {t(selected.label)}
            <Icon name='ArrowDown' />
          </span>
        )}
        items={sortOptions.map(({ id, label }) => ({
          label: t(label),
          onClick: () => setSort(id)
        }))}
        alignRight
      />
    </div>
  )
}

export function TopicListItem ({ topic, singleGroup, setGroupTopicVisibility, removeSuggestedTopic, isSuggested }) {
  const { name, groupTopics, postsTotal, followersTotal } = topic

  const groupTopic = groupTopics.find(ct => ct.group.id === singleGroup.id)

  return (
    <div className={styles.topic}>
      <div className={styles.topicName}>#{name}</div>
      {singleGroup &&
        <div className={styles.topicStats}>{inflectedTotal('post', postsTotal)} • {inflectedTotal('subscriber', followersTotal)}</div>}
      {singleGroup && !isSuggested && (
        <Dropdown
          id='topics-settings-visibility-dropdown'
          alignRight
          className={styles.visibilityDropdown}
          toggleChildren={(
            <span className={cn(styles.visibilityDropdownLabel, styles[`visibilityDropdown${TOPIC_VISIBILITY[groupTopic.visibility]}`])}>
              <Icon name='Eye' />
              <span className={styles.labelContent}>{TOPIC_VISIBILITY[groupTopic.visibility]}</span>
              <Icon name='ArrowDown' />
            </span>
          )}
          items={visibilityOptions.map(({ value, label }) => ({
            label,
            onClick: setGroupTopicVisibility(groupTopic.id, value),
            className: styles[`visibilityDropdown${label}`]
          }))}
        />
      )}
      {singleGroup && isSuggested && (
        <Icon name='Trash' onClick={removeSuggestedTopic(groupTopic.id)} className={styles.removeSuggestedTopicButton} />
      )}
    </div>
  )
}

export default TopicsSettingsTab
