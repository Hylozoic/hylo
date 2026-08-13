import { Grid2x2, Grid3x3 } from 'lucide-react'
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

// Toolbar chrome from the prototype's BDStreamToolbar: a 36px row of segmented
// groups and pills. The prototype hardcodes a dark palette; these carry the same
// shapes onto the theme tokens so the bar works in both schemes.
const GROUP_CLASS = 'inline-flex items-center gap-0.5 h-9 p-[3px] box-border rounded-[9px] bg-background border-2 border-foreground/20'
const PILL_CLASS = 'inline-flex items-center gap-1.5 h-9 px-3 box-border rounded-[9px] bg-background border-2 border-foreground/20 text-foreground text-xs font-semibold cursor-pointer transition-colors hover:border-foreground/40'

/** One segmented-group button. Active reads as the selected green, per the design. */
function ToolBtn ({ active, onClick, tooltip, children }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'grid place-items-center h-full aspect-square rounded-[7px] border-0 cursor-pointer transition-colors',
        active ? 'bg-selected text-white' : 'bg-transparent text-foreground/70 hover:text-foreground hover:bg-foreground/10'
      )}
      data-tooltip-content={tooltip}
      data-tooltip-id='stream-controls-tip'
      aria-pressed={active}
      aria-label={tooltip}
    >
      {children}
    </button>
  )
}

// Shared attrs for the prototype's line icons.
const ico = (props = {}) => ({
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...props
})

const VIEW_MODE_ICONS = {
  cards: <svg {...ico()}><rect x='3' y='4' width='18' height='16' rx='2' /><path d='M3 14h18' /></svg>,
  list: <svg {...ico()}><path d='M4 6h16M4 12h16M4 18h16' /></svg>,
  bigGrid: <Grid2x2 size={15} strokeWidth={1.9} />,
  grid: <Grid3x3 size={15} strokeWidth={1.9} />,
  calendar: <svg {...ico()}><rect x='3' y='4' width='18' height='17' rx='2' /><path d='M3 9h18M8 2v4M16 2v4' /></svg>
}

const SORT_ICON = <svg {...ico({ width: 13, height: 13 })}><path d='M3 6h11M3 12h7M3 18h4' /><path d='M18 8V20M18 20l-3-3M18 20l3-3' /></svg>

const makeFilterDropdown = (selected, options, onChange, t, icon, id) => {
  // Load these strings in the component
  t('Upcoming Events')
  t('Past Events')

  return (
    <Dropdown
      id={id}
      // Pill styling lives on the toggle span: Dropdown forces inline-block on its
      // root, which would defeat the flex centering the pill needs.
      toggleChildren={
        // On phones the pill is just the current label — the glyph and chevron
        // spend width the row does not have
        <span className={PILL_CLASS}>
          {icon && <span className='inline-flex items-center max-sm:hidden'>{icon}</span>}
          {t(options.find(o => o.id === selected)?.label)}
          <Icon name='ArrowDown' className='opacity-60 max-sm:hidden' />
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
    filterDropdown = makeFilterDropdown(postTypeFilter, postTypeOptionsForFilter, changePostTypeFilter, t, null, 'post-type-filter')
  }

  if (view === 'events' && viewMode !== 'calendar') {
    sortDropdown = makeFilterDropdown(timeframe, TIMEFRAME_OPTIONS, changeTimeframe, t, null, 'timeframe-filter')
  } else if (viewMode !== 'calendar') {
    sortDropdown = makeFilterDropdown(sortBy, defaultSortOptions, changeSort, t, SORT_ICON, 'sort-filter')
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

  const showChildPostToggle = ![CONTEXT_MY, 'all', 'public'].includes(context)

  return (
    <div className={cn('flex flex-col gap-1 sm:gap-2 items-center w-full', { [classes.searchActive]: searchActive || searchValue, [classes.extend]: searchActive && searchValue })}>
      {/* Right-justified in the pinned header row, opposite the New button.
          Sort, filter, lenses, then the display toggles — the prototype's order */}
      <div className='flex w-full flex-row items-center justify-end flex-wrap gap-2'>
        {sortDropdown}
        {filterDropdown}

        {/* Phone: the lens group collapses into a dropdown showing the active lens */}
        <div className='sm:hidden'>
          <Dropdown
            id='view-mode-filter-mobile'
            toggleChildren={
              <span className={PILL_CLASS}>
                {VIEW_MODE_ICONS[viewMode] || VIEW_MODE_ICONS.cards}
                <Icon name='ArrowDown' className='opacity-60' />
              </span>
            }
            items={[
              { label: t('Card view'), icon: VIEW_MODE_ICONS.cards, onClick: () => changeView('cards') },
              { label: t('List view'), icon: VIEW_MODE_ICONS.list, onClick: () => changeView('list') },
              { label: t('Large Grid'), icon: VIEW_MODE_ICONS.bigGrid, onClick: () => changeView('bigGrid') },
              { label: t('Small Grid'), icon: VIEW_MODE_ICONS.grid, onClick: () => changeView('grid') },
              ...(postHasDates ? [{ label: t('Calendar'), icon: VIEW_MODE_ICONS.calendar, onClick: () => changeView('calendar') }] : [])
            ]}
          />
        </div>

        <div className={cn(GROUP_CLASS, 'max-sm:hidden')}>
          <ToolBtn active={viewMode === 'cards'} onClick={() => changeView('cards')} tooltip={t('Card view')}>
            {VIEW_MODE_ICONS.cards}
          </ToolBtn>
          <ToolBtn active={viewMode === 'list'} onClick={() => changeView('list')} tooltip={t('List view')}>
            {VIEW_MODE_ICONS.list}
          </ToolBtn>
          <ToolBtn active={viewMode === 'bigGrid'} onClick={() => changeView('bigGrid')} tooltip={t('Large Grid')}>
            {VIEW_MODE_ICONS.bigGrid}
          </ToolBtn>
          <ToolBtn active={viewMode === 'grid'} onClick={() => changeView('grid')} tooltip={t('Small Grid')}>
            {VIEW_MODE_ICONS.grid}
          </ToolBtn>
          {postHasDates && (
            <ToolBtn active={viewMode === 'calendar'} onClick={() => changeView('calendar')} tooltip={t('Calendar')}>
              {VIEW_MODE_ICONS.calendar}
            </ToolBtn>
          )}
        </div>

        <div className={GROUP_CLASS}>
          <ToolBtn
            active={activePostsOnly}
            onClick={handleClickActivePostsOnly}
            tooltip={activePostsOnly ? t('Show both active and completed posts') : t('Hide complete posts, show only active ones')}
          >
            <svg {...ico()}><circle cx='12' cy='12' r='9' /><path d='M8.5 12.5l2.5 2.5 4.5-5' /></svg>
          </ToolBtn>
          {showChildPostToggle && (
            <ToolBtn
              active={childPostInclusion === 'yes'}
              onClick={handleChildPostInclusion}
              tooltip={childPostInclusion === 'yes' ? t('Hide posts from child groups and spaces you are a member of') : t('Show posts from child groups and spaces you are a member of')}
            >
              <svg {...ico()}><rect x='9' y='3' width='6' height='5' rx='1' /><rect x='3' y='16' width='6' height='5' rx='1' /><rect x='15' y='16' width='6' height='5' rx='1' /><path d='M12 8v4M6 16v-2h12v2' /></svg>
            </ToolBtn>
          )}
        </div>

        <div className={GROUP_CLASS}>
          <ToolBtn active={searchActive} onClick={handleSearchToggle} tooltip={t('Search posts')}>
            <svg {...ico()}><circle cx='11' cy='11' r='7' /><path d='M20 20l-3.5-3.5' /></svg>
          </ToolBtn>
        </div>
      </div>
      {searchActive &&
        <div className='w-full'>
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
