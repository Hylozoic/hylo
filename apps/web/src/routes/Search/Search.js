import { cn } from 'util/index'
import { get, intersection, debounce } from 'lodash/fp'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { push } from 'redux-first-history'
import { useLocation } from 'react-router-dom'
import TextInput from 'components/TextInput'
import ScrollListener from 'components/ScrollListener'
import PostCard from 'components/PostCard'
import CommentCard from 'components/CommentCard'
import RoundImage from 'components/RoundImage'
import Highlight from 'components/Highlight'
import Loading from 'components/Loading'
import Pill from 'components/Pill'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import {
  fetchSearchResults,
  getSearchTerm,
  FETCH_SEARCH,
  setSearchTerm,
  setSearchFilter,
  getSearchFilter,
  getSearchResults,
  getHasMoreSearchResults
} from './Search.store'
import { personUrl } from 'util/navigation'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import getQuerystringParam from 'store/selectors/getQuerystringParam'

import classes from './Search.module.scss'

const SEARCH_RESULTS_ID = 'search-results'

export default function Search (props) {
  const dispatch = useDispatch()
  const location = useLocation()
  const { t } = useTranslation()
  const searchFromQueryString = getQuerystringParam('t', location) || ''
  const searchForInput = useSelector(state => getSearchTerm(state, props))
  const filter = useSelector(state => getSearchFilter(state, props))
  const queryResultProps = { search: searchForInput, type: filter }
  const searchResults = useSelector(state => getSearchResults(state, queryResultProps))
  const hasMore = useSelector(state => getHasMoreSearchResults(state, queryResultProps))
  const pending = useSelector(state => !!state.pending[FETCH_SEARCH])

  const updateQueryParam = debounce(500, search =>
    dispatch(changeQuerystringParam(location, 't', search, null, true)))

  const setSearchTermAction = search => dispatch(setSearchTerm(search))
  const setSearchFilterAction = filter => dispatch(setSearchFilter(filter))
  const showPerson = personId => dispatch(push(personUrl(personId)))

  const fetchSearchResultsDebounced = debounce(500, opts => dispatch(fetchSearchResults(opts)))

  const fetchSearchResultsAction = () => {
    return fetchSearchResultsDebounced({ search: searchForInput || searchFromQueryString, filter })
  }

  const fetchMoreSearchResults = () => hasMore
    ? fetchSearchResultsDebounced({ search: searchForInput || searchFromQueryString, filter, offset: searchResults.length })
    : () => {}

  useEffect(() => {
    if (!searchForInput && searchFromQueryString) {
      setSearchTermAction(searchFromQueryString)
    }
    if (searchFromQueryString) {
      fetchSearchResultsAction()
    }
  }, [])

  useEffect(() => {
    fetchSearchResultsAction()
  }, [searchForInput, filter])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Search'),
      icon: 'Search',
      search: false
    })
  }, [])

  return (
    <div className={classes.search}>
      <SearchBar
        searchForInput={searchForInput}
        searchFromQueryString={searchFromQueryString}
        setSearchTerm={setSearchTermAction}
        updateQueryParam={updateQueryParam}
        setSearchFilter={setSearchFilterAction}
        filter={filter}
      />
      <div
        className={classes.searchResults}
        id={SEARCH_RESULTS_ID}
      >
        {searchResults.map(sr =>
          <SearchResult
            key={sr.id}
            searchResult={sr}
            term={searchForInput}
            showPerson={showPerson}
          />)}
        {pending && <Loading type='bottom' />}
        <ScrollListener onBottom={() => fetchMoreSearchResults()} elementId={SEARCH_RESULTS_ID} />
      </div>
    </div>
  )
}

function SearchBar ({
  searchForInput,
  searchFromQueryString,
  setSearchTerm,
  updateQueryParam,
  setSearchFilter,
  filter
}) {
  const { t } = useTranslation()
  const onSearchChange = event => {
    const { value } = event.target
    setSearchTerm(value) // no debounce
    updateQueryParam(value) // debounced
  }
  return (
    <div className={classes.searchBar}>
      <TabBar setSearchFilter={setSearchFilter} filter={filter} />
      <TextInput
        theme={classes}
        inputRef={x => x && x.focus()}
        value={searchForInput || searchFromQueryString}
        placeholder={t('Search by keyword for people, posts and groups')}
        onChange={onSearchChange}
      />
    </div>
  )
}

function TabBar ({ filter, setSearchFilter }) {
  const { t } = useTranslation()
  const tabs = [
    { id: 'all', label: t('All') },
    { id: 'post', label: t('Discussions') },
    { id: 'person', label: t('People') },
    { id: 'comment', label: t('Comments') }
  ]

  return (
    <div className={classes.tabs}>
      {tabs.map(({ id, label }) => (
        <span
          key={id}
          className={cn(classes.tab, { [classes.tabActive]: id === filter })}
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
    terms: term.split(' '),
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
    <div className={classes.searchResult}>
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
    <div className={classes.personCard} onClick={() => showPerson(person.id)}>
      <RoundImage url={person.avatarUrl} className={classes.personImage} large />
      <div className={classes.personDetails}>
        <Highlight {...highlightProps}>
          <div className={classes.personName}>{person.name}</div>
        </Highlight>
        <div className={classes.personLocation}>{person.location}</div>
      </div>
      {matchingSkill && <Pill label={matchingSkill} className={classes.personSkill} small />}
    </div>
  )
}
