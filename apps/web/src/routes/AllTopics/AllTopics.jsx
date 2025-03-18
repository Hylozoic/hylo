import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { debounce, get } from 'lodash/fp'
import { useSelector, useDispatch } from 'react-redux'
import FullPageModal from 'routes/FullPageModal'
import ScrollListener from 'components/ScrollListener'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import { baseUrl } from 'util/navigation'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import isPendingFor from 'store/selectors/isPendingFor'
import toggleGroupTopicSubscribe from 'store/actions/toggleGroupTopicSubscribe'
import fetchTopics from 'store/actions/fetchTopics'
import { FETCH_TOPICS } from 'store/constants'
import {
  setSort,
  setSearch,
  getTopics,
  getHasMoreTopics,
  getTotalTopics,
  getSort,
  getSearch,
  deleteGroupTopic
} from './AllTopics.store'
import SearchBar from './SearchBar'
import TopicListItem from './TopicListItem'
import classes from './AllTopics.module.scss'

const TOPIC_LIST_ID = 'topic-list'

function AllTopics (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  // const [createTopicModalVisible, setCreateTopicModalVisible] = useState(false)
  const [totalTopicsCached, setTotalTopicsCached] = useState(null)

  const routeParams = useRouteParams()
  const groupSlug = routeParams.groupSlug
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const selectedSort = useSelector(getSort)
  const search = useSelector(getSearch)
  const fetchTopicsParams = {
    groupSlug: routeParams.groupSlug,
    sortBy: selectedSort,
    autocomplete: search
  }
  const topics = useSelector(state => getTopics(state, fetchTopicsParams))
  const hasMore = useSelector(state => getHasMoreTopics(state, fetchTopicsParams))
  const totalTopics = useSelector(state => getTotalTopics(state, fetchTopicsParams))
  const fetchIsPending = useSelector(state => isPendingFor(FETCH_TOPICS, state))

  const fetchTopicsAction = debounce(250, () => dispatch(fetchTopics({ ...fetchTopicsParams, first: 20 })))
  const fetchMoreTopics = debounce(250, () => !fetchIsPending && hasMore && dispatch(fetchTopics({ ...fetchTopicsParams, offset: get('length', topics, 0), first: 10 })))

  useEffect(() => {
    fetchTopicsAction()
    updateTopicsCache()
  }, [])

  useEffect(() => {
    return () => {
      dispatch(setSearch(''))
    }
  }, [])

  useEffect(() => {
    if (!totalTopicsCached && totalTopics) {
      updateTopicsCache()
    }
    if (
      selectedSort !== props.selectedSort ||
      search !== props.search ||
      routeParams.groupSlug !== props.routeParams.groupSlug
    ) {
      fetchTopicsAction()
    }
  }, [selectedSort, search, groupSlug, totalTopics])

  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    setHeaderDetails({
      title: 'All Topics',
      icon: 'Topics',
      search: true
    })
  }, [])

  const updateTopicsCache = () => {
    setTotalTopicsCached(totalTopics)
  }

  const deleteGroupTopicHandler = (groupTopicId) => {
    if (window.confirm(t('Are you sure you want to delete this groupTopic?'))) {
      dispatch(deleteGroupTopic(groupTopicId))
    }
  }

  // const toggleTopicModal = () => setCreateTopicModalVisible(!createTopicModalVisible)
  const all = t('All')

  return (
    <FullPageModal fullWidth goToOnClose={baseUrl({ ...routeParams, view: undefined })}>
      <div className={classes.allTopics}>
        <div className={classes.title}>{t('{{groupName}} Topics', { groupName: group ? group.name : all })}</div>
        <div className={classes.subtitle}>{t('{{totalTopicsCached}} Total Topics', { totalTopicsCached })}</div>
        <div className={classes.controls}>
          <SearchBar
            search={search}
            setSearch={(value) => dispatch(setSearch(value))}
            selectedSort={selectedSort}
            setSort={(value) => dispatch(setSort(value))}
            fetchIsPending={fetchIsPending}
          />
        </div>
        <div className={classes.topicList} id={TOPIC_LIST_ID}>
          {topics.map(topic => (
            <TopicListItem
              key={topic.id}
              singleGroup={group}
              topic={topic}
              routeParams={routeParams}
              deleteItem={deleteGroupTopicHandler}
              toggleSubscribe={(groupTopic) => dispatch(toggleGroupTopicSubscribe(groupTopic))}
            />
          ))}
          <ScrollListener
            onBottom={() => fetchMoreTopics()}
            elementId={TOPIC_LIST_ID}
          />
        </div>
      </div>
    </FullPageModal>
  )
}

export default AllTopics
