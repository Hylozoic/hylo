import { get, intersection, debounce } from 'lodash/fp'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  getHasMoreSearchResults,
  getHasFetchedSearchResults,
  getSearchError,
  formatSearchErrorMessage
} from './Search.store'
import { personUrl } from '@hylo/navigation'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import { cn } from 'util/index'
import { heyAxolotl, puzzledAxolotl } from 'util/assets'
import { CENTER_COLUMN_ID } from 'util/scrolling'

import classes from './Search.module.scss'

const MIN_SEARCH_TERM_LENGTH = 2

export default function Search (props) {
  const dispatch = useDispatch()
  const location = useLocation()
  const { t } = useTranslation()
  const searchFromQueryString = getQuerystringParam('t', location) || ''
  const groupSlug = getQuerystringParam('groupSlug', location) || ''
  const group = useSelector(state => groupSlug && getGroupForSlug(state, groupSlug))
  const previousLocation = useSelector(getPreviousLocation)
  const groupIds = useMemo(() => group?.id ? [group.id] : null, [group?.id])
  const [searchForInput, setSearchForInput] = useState(searchFromQueryString)
  const [filter, setFilter] = useState('all')
  const searchTermReady = searchForInput.trim().length >= MIN_SEARCH_TERM_LENGTH
  const groupScopeReady = !groupSlug || !!groupIds
  const queryResultProps = { search: searchForInput, type: filter, groupIds }
  const searchResults = useSelector(state => getSearchResults(state, queryResultProps))
  const hasFetched = useSelector(state => getHasFetchedSearchResults(state, queryResultProps))
  const hasMore = useSelector(state => getHasMoreSearchResults(state, queryResultProps))
  const searchError = useSelector(state => getSearchError(state, queryResultProps))
  const searchErrorMessage = searchError ? formatSearchErrorMessage(searchError, t) : null
  const pending = useSelector(state => !!state.pending[FETCH_SEARCH])
  const showLoading = searchTermReady && !searchError && (!groupScopeReady || pending || !hasFetched)
  const showEmptyState = searchTermReady && groupScopeReady && hasFetched && !pending && !searchError && searchResults.length === 0
  const showErrorState = searchTermReady && groupScopeReady && !pending && searchError && searchResults.length === 0
  const inputRef = useRef(null)
  const requestedOffsetRef = useRef(null)

  const showPerson = useCallback(personId => dispatch(push(personUrl(personId))), [dispatch])

  const updateQueryParam = useCallback(
    debounce(500, search => {
      return dispatch(changeQuerystringParam(location, 't', search, null, true))
    }),
    [dispatch, location]
  )
  const fetchSearchResultsDebounced = useCallback(
    debounce(500, (opts) => {
      return dispatch(fetchSearchResults(opts))
    }),
    [dispatch]
  )

  const fetchSearchResultsAction = useCallback(() => {
    if (!searchTermReady || !groupScopeReady) return
    requestedOffsetRef.current = null
    return fetchSearchResultsDebounced({ search: searchForInput, filter, groupIds })
  }, [fetchSearchResultsDebounced, searchForInput, filter, groupIds, searchTermReady, groupScopeReady])

  const fetchMoreSearchResults = useCallback(() => {
    if (!searchTermReady || !groupScopeReady || !hasMore || pending) return
    const offset = searchResults.length
    if (requestedOffsetRef.current === offset) return
    requestedOffsetRef.current = offset
    dispatch(fetchSearchResults({ search: searchForInput, filter, offset, groupIds }))
  }, [dispatch, searchTermReady, groupScopeReady, hasMore, pending, searchResults.length, searchForInput, filter, groupIds])

  useEffect(() => {
    fetchSearchResultsAction()
  }, [fetchSearchResultsAction])

  // Person cards are short, so a people-heavy All page often never overflows.
  // ScrollListener only fires after a scroll, so keep fetching until the list fills the column.
  useLayoutEffect(() => {
    if (!searchTermReady || pending || !hasFetched || !hasMore || searchError) return
    const el = document.getElementById(CENTER_COLUMN_ID)
    if (!el) return
    if (el.scrollHeight <= el.clientHeight + 250) {
      fetchMoreSearchResults()
    }
  }, [searchTermReady, pending, hasFetched, hasMore, searchError, searchResults.length, fetchMoreSearchResults])

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
            inputClassName='border-2 border-transparent transition-all duration-200 focus:border-focus w-full min-w-[300px] sm:min-w-[375px] max-w-[750px] bg-input rounded-lg text-foreground placeholder-foreground/40 py-1 pl-7 outline-none'
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
      mobileBackButton: true,
      backTo: backDestination,
      icon: undefined,
      search: false
    })
  }, [SearchInput, backDestination, setHeaderDetails])

  return (
    <div className='w-full p-2 overflow-x-hidden'>
      <div className='w-full max-w-[750px] mx-auto flex flex-col gap-2 relative'>
        {group && (
          <span className='flex fit-content align-center items-center px-2 py-1 rounded-md bg-selected/40 border-2 border-selected'>
            <span className='flex-1'>Searching in group {group.name}</span>
            <Icon name='Ex' className='inline-block cursor-pointer pl-2' onClick={handleClearGroup} />
          </span>
        )}
        <TabBar setSearchFilter={setFilter} filter={filter} />
        <div className='w-full'>
          {groupScopeReady && searchResults.map(sr =>
            <SearchResult
              key={sr.id}
              searchResult={sr}
              term={searchForInput}
              showPerson={showPerson}
              childPost={!groupSlug}
            />)}
          {showErrorState && (
            <SearchStatus
              imageSrc={puzzledAxolotl}
              message={searchErrorMessage}
              variant='error'
            />
          )}
          {showEmptyState && (
            <SearchStatus
              imageSrc={heyAxolotl}
              message={t('No results for this search')}
              subtitle={t('Try searching with different keywords')}
            />
          )}
          {searchErrorMessage && searchResults.length > 0 && (
            <div className='text-center text-destructive py-4 px-2'>
              {searchErrorMessage}
            </div>
          )}
          {showLoading && <Loading type='bottom' />}
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
    <div className='flex gap-2 justify-center items-center rounded-lg bg-darkening/10 p-2'>
      {tabs.map(({ id, label }) => (
        <span
          key={id}
          className={cn('border-2 border-foreground/20 rounded-lg px-2 py-1 hover:cursor-pointer transition-all hover:border-foreground/50 hover:scale-105', { 'border-selected bg-selected': id === filter })}
          onClick={() => setSearchFilter(id)}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

function SearchStatus ({ imageSrc, message, subtitle, variant = 'empty' }) {
  return (
    <div className='flex flex-col items-center justify-center py-10 px-4 text-center'>
      <img
        src={imageSrc}
        alt=''
        className='w-40 max-w-[50%] h-auto object-contain mb-4 opacity-90'
      />
      <p className={cn('text-lg font-medium', variant === 'error' ? 'text-destructive' : 'text-foreground/80')}>
        {message}
      </p>
      {subtitle && (
        <p className='text-sm text-foreground/60 mt-2 max-w-md'>
          {subtitle}
        </p>
      )}
    </div>
  )
}

function SearchResult ({
  searchResult,
  term = '',
  showPerson,
  childPost
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
          childPost={childPost}
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
