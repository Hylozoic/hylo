import { cn } from 'util/index'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Tooltip from 'components/Tooltip'
import { CONTEXT_MY } from 'store/constants'
import { COLLECTION_SORT_OPTIONS, STREAM_SORT_OPTIONS } from 'util/constants'

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

const DECISIONS_OPTIONS = [
  { id: 'proposals', label: 'Proposals' },
  { id: 'moderation', label: 'Moderation' }
]

const TIMEFRAME_OPTIONS = [
  { id: 'future', label: 'Upcoming Events' },
  { id: 'past', label: 'Past Events' }
]

const makeDropdown = (selected, options, onChange, t) => {
  // Load these strings in the component
  t('Proposals')
  t('Moderation')
  t('Upcoming Events')
  t('Past Events')

  return (
    <Dropdown
      className='bg-primary rounded text-xs px-2 mr-2 hover:scale-125 transition-all'
      toggleChildren={
        <span className={classes.dropdownLabel}>
          <Icon name='ArrowDown' />
          {t(options.find(o => o.id === selected)?.label)}
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
  customViewType,
  sortBy,
  postTypeFilter,
  viewMode,
  changeSearch,
  changeSort,
  changeTab,
  changeView,
  context,
  searchValue,
  view,
  customPostTypes,
  changeChildPostInclusion,
  childPostInclusion,
  decisionView,
  changeDecisionView,
  timeframe,
  changeTimeframe
}) => {
  const { t } = useTranslation()
  let decisionViewDropdown, timeframeDropdown

  const [searchActive, setSearchActive] = useState(!!searchValue)
  const [searchState, setSearchState] = useState('')

  const postTypeOptionsForFilter = customPostTypes && customPostTypes.length > 1 ? POST_TYPE_OPTIONS.filter(postType => postType.label === 'All Posts' || customPostTypes.includes(postType.id)) : POST_TYPE_OPTIONS
  const postTypeFilterDropdown = makeDropdown(postTypeFilter, postTypeOptionsForFilter, changeTab, t)

  if (view === 'decisions') {
    decisionViewDropdown = makeDropdown(decisionView, DECISIONS_OPTIONS, changeDecisionView, t)
  }

  if (view === 'events') {
    timeframeDropdown = makeDropdown(timeframe, TIMEFRAME_OPTIONS, changeTimeframe, t)
  }

  const handleSearchToggle = () => {
    setSearchActive(!searchActive)
  }
  const handleChildPostInclusion = () => {
    const updatedValue = childPostInclusion === 'yes' ? 'no' : 'yes'
    changeChildPostInclusion(updatedValue)
  }

  return (
    <div className={cn(classes.streamViewContainer, { [classes.searchActive]: searchActive || searchValue, [classes.extend]: searchActive && searchValue })}>
      <div className='flex w-full flex-row-reverse justify-between'>
        <div className={cn('bg-primary px-2 flex items-center rounded transition-all', {'bg-selected': searchActive })} onClick={handleSearchToggle}>
          <Icon name='Search' className={cn(classes.toggleIcon, { [classes.active]: searchActive })} />
        </div>
        {![CONTEXT_MY, 'all', 'public'].includes(context) &&
          <div
            className={cn('bg-primary rounded text-foreground px-1 flex items-center transition-all hover:scale-125 group')}
            onClick={handleChildPostInclusion}
            data-tooltip-content={childPostInclusion === 'yes' ? t('Hide posts from child groups you are a member of') : t('Show posts from child groups you are a member of')}
            data-tooltip-id='childgroup-toggle-tt'
          >
            <Icon name='Subgroup' className={cn('p-1 rounded transition-all group-hover:bg-selected/50', { 'bg-selected': childPostInclusion === 'yes' })} />
          </div>}
        <Tooltip
          delay={250}
          id='childgroup-toggle-tt'
          position='bottom'
        />
        <div className='bg-primary rounded px-1 flex gap-2 items-center'>
          <div
            className={cn('rounded px-1 cursor-pointer hover:bg-selected/50 hover:scale-125 transition-all', {'bg-selected': viewMode === 'cards' })}
            onClick={() => changeView('cards')}
            data-tooltip-content={t('Card view')}
            data-tooltip-id='stream-viewmode-tip'
          >
            <Icon name='CardView' />
          </div>

          <div
            className={cn('rounded px-1 cursor-pointer hover:bg-selected/50 hover:scale-125 transition-all', {'bg-selected': viewMode === 'list' })}
            onClick={() => changeView('list')}
            data-tooltip-content={t('List view')}
            data-tooltip-id='stream-viewmode-tip'
          >
            <Icon name='ListView' />
          </div>

          <div
            className={cn('rounded px-1 cursor-pointer hover:bg-selected/50 hover:scale-125 transition-all', {'bg-selected': viewMode === 'bigGrid' })}
            onClick={() => changeView('bigGrid')}
            data-tooltip-content={t('Large Grid')}
            data-tooltip-id='stream-viewmode-tip'
          >
            <Icon name='GridView' className={classes.gridViewIcon} />
          </div>

          <div
            className={cn('rounded px-1 cursor-pointer hover:bg-selected/50 hover:scale-125 transition-all', {'bg-selected': viewMode === 'grid' }, classes.smallGrid)}
            onClick={() => changeView('grid')}
            data-tooltip-content={t('Small Grid')}
            data-tooltip-id='stream-viewmode-tip'
          >
            <Icon name='SmallGridView' className={classes.gridViewIcon} />
          </div>

          <div
            className={cn({ [classes.modeActive]: viewMode === 'grid' }, classes.calendar)}
            onClick={() => changeView('calendar')}
            data-tooltip-content={t('Calendar')}
            data-tooltip-id='stream-viewmode-tip'
          >
            <Icon name='Calendar' className={classes.gridViewIcon} />
          </div>
        </div>
        {view === 'events' && timeframeDropdown}
        {view !== 'events' && makeDropdown(sortBy, customViewType === 'collection' ? COLLECTION_SORT_OPTIONS : STREAM_SORT_OPTIONS, changeSort, t)}
        {!['events', 'projects', 'decisions', 'ask-and-offer'].includes(view) && postTypeFilterDropdown}
        {view === 'decisions' && decisionViewDropdown}
        <Tooltip id='stream-viewmode-tip' position='bottom' />
      </div>
      {searchActive &&
        <div>
          <input
            autoFocus
            className='bg-black/20 px-4 py-2 rounded flex items-center text-foreground w-full mt-2'
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
    </div>
  )
}

export default StreamViewControls
