import { get, intersection, debounce } from 'lodash/fp'
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { push } from 'redux-first-history'
import { useLocation, Routes, Route } from 'react-router-dom'
import TextInput from 'components/TextInput'
import Icon from 'components/Icon'
import ScrollListener from 'components/ScrollListener'
import PostCard from 'components/PostCard'
import CommentCard from 'components/CommentCard'
import RoundImage from 'components/RoundImage'
import Highlight from 'components/Highlight'
import Loading from 'components/Loading'
import Pill from 'components/Pill'
import PostDialog from 'components/PostDialog'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import {
  fetchSearchResults,
  FETCH_SEARCH,
  getSearchResults,
  getHasMoreSearchResults
} from './Search.store'
import { personUrl } from '@hylo/navigation'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import { cn } from 'util/index'
import { CENTER_COLUMN_ID } from 'util/scrolling'

import classes from './Search.module.scss'

export default function Search (props) {
  const dispatch = useDispatch()
  const location = useLocation()
  const { t } = useTranslation()
  const searchFromQueryString = getQuerystringParam('t', location) || ''
  const groupSlug = getQuerystringParam('groupSlug', location) || ''
  const group = useSelector(state => groupSlug && getGroupForSlug(state, groupSlug))
  const previousLocation = useSelector(getPreviousLocation)
  const groupIds = useMemo(() => group ? [group.id] : null, [group.id])
  const [searchForInput, setSearchForInput] = useState(searchFromQueryString)
  const [filter, setFilter] = useState('all')
  const queryResultProps = { search: searchForInput, type: filter, groupIds }
  const searchResults = useSelector(state => getSearchResults(state, queryResultProps))
  const hasMore = useSelector(state => getHasMoreSearchResults(state, queryResultProps))
  const pending = useSelector(state => !!state.pending[FETCH_SEARCH])
  const inputRef = React.useRef(null)

  const showPerson = useCallback(personId => dispatch(push(personUrl(personId))), [dispatch])

  const updateQueryParam = useCallback(
    debounce(500, search => {
      return dispatch(changeQuerystringParam(location, 't', search, null, true))
    }),
    [dispatch, location]
  )
  // Move this outside the component or use useCallback to preserve it between renders
  const fetchSearchResultsDebounced = useCallback(
    debounce(500, (opts) => {
      return dispatch(fetchSearchResults(opts))
    }),
    [dispatch] // Only recreate if dispatch changes
  )

  const fetchSearchResultsAction = useCallback(() => {
    return fetchSearchResultsDebounced({ search: searchForInput, filter, groupIds })
  }, [fetchSearchResultsDebounced, searchForInput, filter, groupIds])

  const fetchMoreSearchResults = useCallback(() => hasMore
    ? fetchSearchResultsDebounced({ search: searchForInput, filter, offset: searchResults.length, groupIds })
    : () => {},
  [fetchSearchResultsDebounced, hasMore, searchForInput, filter, searchResults.length, groupIds])

  useEffect(() => {
    fetchSearchResultsAction()
  }, [searchForInput, filter, groupIds])

  const handleClearGroup = useCallback(() => {
    dispatch(changeQuerystringParam(location, 'groupSlug', null, null, false))
  })

  // Create a component that will auto-focus itself when mounted
  const SearchInput = React.useCallback(() => {
    return (
      <div className='w-full flex justify-center relative'>
        <div className='relative flex items-center'>
          <Icon name='Search' className='left-2 absolute opacity-50 z-50' />
          <TextInput
            inputClassName='border-2 border-transparent transition-all duration-200 focus:border-focus w-full min-w-[375px] max-w-[750px] bg-black/20 rounded-lg text-foreground placeholder-foreground/40 py-1 pl-7 outline-none'
            inputRef={inputRef}
            value={searchForInput}
            placeholder={t('Search for people, posts and comments')}
            autoFocus
            onChange={event => {
              const { value } = event.target
              setSearchForInput(value)
              updateQueryParam(value)
            }}
          />
        </div>
      </div>
    )
  }, [searchForInput, t, updateQueryParam])

  const { setHeaderDetails } = useViewHeader()
  const [backDestination, setBackDestination] = useState(null)
  const fromParam = getQuerystringParam('from', location)
  const hasRemovedFromParam = React.useRef(false)

  // Set back destination once when component mounts or when fromParam/previousLocation changes
  useEffect(() => {
    const nonSearchPrevious = previousLocation && !previousLocation.pathname.startsWith('/search')
      ? `${previousLocation.pathname}${previousLocation.search || ''}`
      : null
    const newBackDestination = fromParam || nonSearchPrevious
    if (newBackDestination) {
      setBackDestination(prev => prev || newBackDestination)
    }
  }, [fromParam, previousLocation?.pathname, previousLocation?.search])

  // Remove from param from URL once when it exists
  useEffect(() => {
    if (fromParam && !hasRemovedFromParam.current) {
      hasRemovedFromParam.current = true
      dispatch(changeQuerystringParam(location, 'from', null, undefined, true))
    }
  }, [fromParam, dispatch, location])

  useEffect(() => {
    setHeaderDetails({
      title: <SearchInput />,
      centered: true,
      backButton: true,
      backTo: backDestination,
      icon: undefined,
      search: false
    })
  }, [SearchInput, backDestination, setHeaderDetails])

  return (
    <div className='w-full m-2'>
      <div className='w-full max-w-[750px] mx-auto flex flex-col gap-2 relative'>
        {group && (
          <span className='flex fit-content align-center items-center px-2 py-1 rounded-md bg-selected/40 border-2 border-selected'>
            <span className='flex-1'>Searching in group {group.name}</span>
            <Icon name='Ex' className='inline-block cursor-pointer pl-2' onClick={handleClearGroup} />
          </span>
        )}
        <TabBar setSearchFilter={setFilter} filter={filter} />
        <div className='w-full'>
          {searchResults.map(sr =>
            <SearchResult
              key={sr.id}
              searchResult={sr}
              term={searchForInput}
              showPerson={showPerson}
            />)}
          {pending && <Loading type='bottom' />}
          <ScrollListener onBottom={() => fetchMoreSearchResults()} elementId={CENTER_COLUMN_ID} />
        </div>

        <Routes>
          <Route path='post/:postId' element={<PostDialog />} />
        </Routes>
      </div>
    </div>
  )
}

function TabBar ({ filter, setSearchFilter }) {
  const { t } = useTranslation()
  const tabs = [
    { id: 'all', label: t('All') },
    { id: 'post', label: t('Posts') },
    { id: 'comment', label: t('Comments') },
    { id: 'person', label: t('People') }
  ]

  return (
    <div className='flex gap-2 justify-center items-center rounded-lg bg-black/10 p-2'>
      {tabs.map(({ id, label }) => (
        <span
          key={id}
          className={cn('border-2 border-foreground/20 rounded-lg px-2 py-1 hover:cursor-pointer transition-all hover:border-foreground/100 hover:scale-105', { 'border-selected bg-selected': id === filter })}
          onClick={() => setSearchFilter(id)}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

function SearchResult ({
  searchResult,
  term = '',
  showPerson
}) {
  const { type, content } = searchResult
  if (!content) {
    console.log(`Search Result of "${type}" without data (see DEV-395):`, content)
    return null
  }

  const highlightProps = {
    terms: [], // term.split(' '),
    highlightClassName: classes.highlight
  }

  let component
  switch (type) {
    case 'Person':
      component = (
        <PersonCard
          person={content}
          showPerson={showPerson}
          highlightProps={highlightProps}
        />
      )
      break
    case 'Post':
      component = (
        <PostCard
          className={classes.postcardExpand}
          post={content}
          highlightProps={highlightProps}
        />
      )
      break
    case 'Comment':
      component = (
        <CommentCard
          comment={content}
          expanded={false}
          highlightProps={highlightProps}
        />
      )
      break
  }
  if (!component) return null
  return (
    <div>
      {component}
    </div>
  )
}

function PersonCard ({ person, showPerson, highlightProps }) {
  if (!person) return null

  const matchingSkill = get('0', intersection(
    person.skills.map(s => s.name.toLowerCase()),
    highlightProps.terms.map(t => t.toLowerCase())
  ))

  return (
    <div
      className='rounded-xl cursor-pointer p-2 flex transition-all bg-card/40 border-2 border-card/30 shadow-md hover:shadow-lg mb-4 relative hover:z-50 hover:scale-105 duration-400 items-center'
      onClick={() => showPerson(person.id)}
    >
      <RoundImage url={person.avatarUrl} className={classes.personImage} large />
      <div className='text-foreground'>
        <Highlight {...highlightProps}>
          <div className='text-lg font-bold text-base'>{person.name}</div>
        </Highlight>
        <div className='text-sm text-foreground/50'>{person.location}</div>
      </div>
      {matchingSkill && <Pill label={matchingSkill} className={classes.personSkill} small />}
    </div>
  )
}
