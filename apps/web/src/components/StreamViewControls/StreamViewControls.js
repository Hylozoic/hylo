import { ArrowDownWideNarrow } from 'lucide-react'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Tooltip from 'components/Tooltip'
import { CONTEXT_MY } from 'store/constants'
import { COLLECTION_SORT_OPTIONS, STREAM_SORT_OPTIONS } from 'util/constants'
import { cn } from 'util/index'

import classes from './StreamViewControls.module.scss'

const POST_TYPE_OPTIONS = [
  { id: undefined, label: 'All Posts' },
  { id: 'discussion', label: 'Discussions' },
  { id: 'event', label: 'Events' },
  { id: 'offer', label: 'Offers' },
  { id: 'project', label: 'Projects' },
  { id: 'proposal', label: 'Proposals' },
  { id: 'request', label: 'Requests' },
  { id: 'resource', label: 'Resources' }
]

const TIMEFRAME_OPTIONS = [
  { id: 'future', label: 'Upcoming Events' },
  { id: 'past', label: 'Past Events' }
]

const makeFilterDropdown = (selected, options, onChange, t, IconComponent) => {
  // Load these strings in the component
  t('Upcoming Events')
  t('Past Events')

  return (
    <Dropdown
      className='bg-background border-foreground/20 border-2 shadow-xl rounded text-xs px-2 mr-2 hover:scale-125 transition-all z-[100]'
      toggleChildren={
        <span className={classes.dropdownLabel}>
          {IconComponent && <IconComponent size={14} className='text-muted-foreground mr-1' />}
          {t(options.find(o => o.id === selected)?.label)}
          <Icon name='ArrowDown' />
        </span>
      }
      items={options.map(({ id, label }) => ({
        label: t(label),
        onClick: () => onChange(id)
      }))}
    />
  )
}

const StreamViewControls = ({
  activePostsOnly,
  changeActivePostsOnly,
  changeChildPostInclusion,
  changePostTypeFilter,
  changeSearch,
  changeSort,
  changeTimeframe,
  changeView,
  childPostInclusion,
  context,
  customViewType,
  postTypeFilter,
  postTypesAvailable,
  searchValue,
  sortBy,
  timeframe,
  view,
  viewMode
}) => {
  const { t } = useTranslation()
  const location = useLocation()
  const [searchActive, setSearchActive] = useState(!!searchValue)
  const [searchState, setSearchState] = useState('')

  const defaultSortOptions = customViewType === 'collection' ? COLLECTION_SORT_OPTIONS : STREAM_SORT_OPTIONS
  const postHasDates = view !== 'discussions'

  let filterDropdown, sortDropdown

  if (!postTypesAvailable || postTypesAvailable.length > 1) {
    const postTypeOptionsForFilter = postTypesAvailable && postTypesAvailable.length > 1
      ? POST_TYPE_OPTIONS.filter(postType => postType.label === 'All Posts' || postTypesAvailable.includes(postType.id))
      : POST_TYPE_OPTIONS
    filterDropdown = makeFilterDropdown(postTypeFilter, postTypeOptionsForFilter, changePostTypeFilter, t)
  }

  if (view === 'events' && viewMode !== 'calendar') {
    sortDropdown = makeFilterDropdown(timeframe, TIMEFRAME_OPTIONS, changeTimeframe, t)
  } else if (viewMode !== 'calendar') {
    sortDropdown = makeFilterDropdown(sortBy, defaultSortOptions, changeSort, t, ArrowDownWideNarrow)
  }

  const handleSearchToggle = () => {
    setSearchActive(!searchActive)
  }

  const handleClickActivePostsOnly = useCallback(() => {
    changeActivePostsOnly(!activePostsOnly)
  }, [activePostsOnly, location])

  const handleChildPostInclusion = useCallback(() => {
    const updatedValue = childPostInclusion === 'yes' ? 'no' : 'yes'
    changeChildPostInclusion(updatedValue)
  }, [childPostInclusion, location]) // Location is needed to get the updated passed in changeChildPostInclusion callback

  return (
    <div className={cn('flex flex-col gap-1 sm:gap-2 p-2 sm:p-4 items-center', { [classes.searchActive]: searchActive || searchValue, [classes.extend]: searchActive && searchValue })}>
      <div className='flex w-full flex-row-reverse justify-between flex-wrap gap-y-1'>
        <div className={cn('bg-background border-foreground/20 border-2 shadow-xl px-2 flex items-center rounded transition-all cursor-pointer', { 'bg-selected': searchActive })} onClick={handleSearchToggle}>
          <Icon name='Search' className={cn(classes.toggleIcon, { [classes.active]: searchActive })} />
        </div>
        <div className='bg-background border-foreground/20 border-2 shadow-xl rounded px-1 flex gap-2 items-center'>
          <div
            className={cn('bg-midground shadow-sm rounded text-foreground px-1 flex items-center transition-all hover:scale-125 group cursor-pointer')}
            onClick={handleClickActivePostsOnly}
            data-tooltip-content={activePostsOnly ? t('Show both active and completed posts') : t('Hide complete posts, show only active ones')}
            data-tooltip-id='stream-controls-tip'
          >
            <Icon name='Checkmark' className={cn('p-1 rounded transition-all group-hover:bg-selected/50', { 'bg-selected': activePostsOnly })} />
          </div>
          {![CONTEXT_MY, 'all', 'public'].includes(context) &&
            <div
              className={cn('bg-midground shadow-sm rounded text-foreground px-1 flex items-center transition-all hover:scale-125 group cursor-pointer')}
              onClick={handleChildPostInclusion}
              data-tooltip-content={childPostInclusion === 'yes' ? t('Hide posts from child groups you are a member of') : t('Show posts from child groups you are a member of')}
              data-tooltip-id='stream-controls-tip'
            >
              <Icon name='Subgroup' className={cn('p-1 rounded transition-all group-hover:bg-selected/50', { 'bg-selected': childPostInclusion === 'yes' })} />
            </div>}
        </div>
        <div className='bg-background border-foreground/20 border-2 shadow-xl rounded p-1 flex gap-2 items-center'>
          <div
            className={cn('rounded bg-midground shadow-sm px-1 cursor-pointer hover:bg-selected/50 hover:scale-125 transition-all items-center flex h-full', { 'bg-selected': viewMode === 'cards' })}
            onClick={() => changeView('cards')}
            data-tooltip-content={t('Card view')}
            data-tooltip-id='stream-controls-tip'
          >
            <Icon name='CardView' />
          </div>

          <div
            className={cn('rounded bg-midground shadow-sm px-1 cursor-pointer hover:bg-selected/50 hover:scale-125 transition-all items-center flex h-full', { 'bg-selected': viewMode === 'list' })}
            onClick={() => changeView('list')}
            data-tooltip-content={t('List view')}
            data-tooltip-id='stream-controls-tip'
          >
            <Icon name='ListView' />
          </div>

          <div
            className={cn('rounded bg-midground shadow-sm px-1 cursor-pointer hover:bg-selected/50 hover:scale-125 transition-all items-center flex h-full', { 'bg-selected': viewMode === 'bigGrid' })}
            onClick={() => changeView('bigGrid')}
            data-tooltip-content={t('Large Grid')}
            data-tooltip-id='stream-controls-tip'
          >
            <Icon name='GridView' className={classes.gridViewIcon} />
          </div>

          <div
            className={cn('rounded bg-midground shadow-sm px-1 cursor-pointer hover:bg-selected/50 hover:scale-125 transition-all items-center flex h-full', { 'bg-selected': viewMode === 'grid' }, classes.smallGrid)}
            onClick={() => changeView('grid')}
            data-tooltip-content={t('Small Grid')}
            data-tooltip-id='stream-controls-tip'
          >
            <Icon name='SmallGridView' className={classes.gridViewIcon} />
          </div>

          {postHasDates && (
            <div
              className={cn('rounded bg-midground shadow-sm px-1 cursor-pointer hover:bg-selected/50 hover:scale-125 transition-all items-center flex h-full', { 'bg-selected': viewMode === 'calendar' }, classes.calendar)}
              onClick={() => changeView('calendar')}
              data-tooltip-content={t('Calendar')}
              data-tooltip-id='stream-controls-tip'
            >
              <Icon name='Calendar' className={classes.gridViewIcon} />
            </div>
          )}
        </div>
        {filterDropdown}
        {sortDropdown}
      </div>
      {searchActive &&
        <div>
          <input
            autoFocus
            className='bg-input text-foreground px-4 py-2 rounded flex items-center text-foreground w-full mt-2'
            type='text'
            onChange={e => setSearchState(e.target.value)}
            onKeyUp={e => {
              if (e.keyCode === 13) {
                setSearchState('')
                setSearchActive(false)
                changeSearch(e.target.value)
                e.target.blur()
              }
            }}
            placeholder={t('Search posts')}
            value={searchState}
          />
        </div>}
      {searchValue &&
        <div
          className={classes.searchValue}
          onClick={() => changeSearch('')}
        >
          &quot;{searchValue}&quot;
          <Icon name='Ex' className={classes.textEx} />
        </div>}
      <Tooltip id='stream-controls-tip' position='bottom' />
    </div>
  )
}

export default StreamViewControls
