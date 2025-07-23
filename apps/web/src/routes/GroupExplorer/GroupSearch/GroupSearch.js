import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import { useSelector } from 'react-redux'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import NoPosts from 'components/NoPosts'
import ScrollListener from 'components/ScrollListener'
import GroupCard from 'components/GroupCard'
import GroupViewFilter from '../GroupViewFilter'
import useRouteParams from 'hooks/useRouteParams'
import useDebounce from 'hooks/useDebounce'
import useEnsureSearchedGroups from 'hooks/useEnsureSearchedGroups'
import getMe from 'store/selectors/getMe'
import { SORT_NAME, SORT_NEAREST, SORT_SIZE } from 'store/constants'
import { CENTER_COLUMN_ID } from 'util/scrolling'
import { FARM_VIEW, FARM_TYPES, PRODUCT_CATEGORIES, MANAGEMENT_PLANS, FARM_CERTIFICATIONS } from 'util/constants'
import classes from './GroupSearch.module.scss'

const baseList = [{ value: '', label: 'All' }]

export default function GroupSearch ({ viewFilter, changeView }) {
  const currentUser = useSelector(state => getMe(state))
  const nearCoord = currentUser && currentUser.locationObject
    ? {
        lng: parseFloat(currentUser.locationObject.center.lng),
        lat: parseFloat(currentUser.locationObject.center.lat)
      }
    : null
  const membershipGroupIds = currentUser ? currentUser.memberships.toModelArray().map(membership => membership.group.id) : []
  const [sortBy, setSortBy] = useState(SORT_NAME)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [filterToggle, setFilterToggle] = useState(false)
  const [groupType, setGroupType] = useState(null)
  const debouncedSearchTerm = useDebounce(search, 500)
  const routeParams = useRouteParams()
  const selectedGroupSlug = routeParams.groupSlug
  const [farmQuery, setFarmQuery] = useState({ farmType: '', certOrManagementPlan: '', productCategories: '' })
  const {
    groups = [],
    pending = false,
    fetchMoreGroups,
    hasMore
  } = useEnsureSearchedGroups({
    farmQuery,
    groupType,
    nearCoord,
    offset,
    search: debouncedSearchTerm,
    sortBy,
    visibility: [3]
  })
  const { t } = useTranslation()

  useEffect(() => {
    setOffset(0)
  }, [search, sortBy, groupType])

  useEffect(() => {
    if (viewFilter === FARM_VIEW && nearCoord) {
      setSortBy(SORT_NEAREST)
    }
  }, [viewFilter])

  useEffect(() => viewFilter === FARM_VIEW ? setGroupType(FARM_VIEW) : setGroupType(null), [viewFilter])

  const loadMore = () => {
    if (!pending && hasMore) {
      fetchMoreGroups(offset)
      setOffset(prevOffset => prevOffset + 20) // Assuming 20 is the page size
    }
  }

  return (
    <>
      <div className='sticky -top-2 z-[40] flex flex-col gap-2 font-size-16 py-4 px-2 bg-gradient-to-b from-midground to-transparent'>
        <div className='flex justify-between items-center'>
          <GroupViewFilter viewFilter={viewFilter} changeView={changeView} />
          <div className='flex gap-2'>
            {viewFilter === FARM_VIEW
              ? (
                <button
                  onClick={() => setFilterToggle(!filterToggle)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border-2 border-foreground/20 scale-100 hover:scale-105 transition-all',
                    filterToggle
                      ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                      : 'bg-background text-foreground border-foreground/20 hover:bg-background/80'
                  )}
                >
                  <Icon
                    name='Filter'
                    className={cn(
                      'w-4 h-4',
                      filterToggle ? 'text-primary' : 'text-foreground/60'
                    )}
                  />
                  <span className='font-bold'>{t('Filters')}</span>
                  {filterToggle && <Icon name='Ex' className='w-4 h-4 ml-1' />}
                </button>
                )
              : <div />}
            {makeDropdown({ selected: sortBy, options: sortOptions(t, nearCoord), onChange: setSortBy, filterLabel: `${t('Sort by')}: `, t })}
          </div>
        </div>
        {filterToggle && viewFilter === FARM_VIEW &&
          <div className={classes.filterList}>
            {makeDropdown({ selected: farmQuery.farmType, options: convertListValueKeyToId(baseList.concat(FARM_TYPES)), onChange: (value) => setFarmQuery({ ...farmQuery, farmType: value }), filterLabel: t('Farm Type: '), isFilter: true, t })}
            {makeDropdown({ selected: farmQuery.productCategories, options: convertListValueKeyToId(baseList.concat(PRODUCT_CATEGORIES)), onChange: (value) => setFarmQuery({ ...farmQuery, productCategories: value }), filterLabel: t('Operation: '), isFilter: true, t })}
            {makeDropdown({ selected: farmQuery.certOrManagementPlan, options: convertListValueKeyToId(baseList.concat(MANAGEMENT_PLANS, FARM_CERTIFICATIONS)), onChange: (value) => setFarmQuery({ ...farmQuery, certOrManagementPlan: value }), filterLabel: t('Management Techniques: '), isFilter: true, t })}
          </div>}
      </div>
      <div className='w-full pb-4 mb-4 border-b-foreground/20 border-dashed border-t-0 border-l-0 border-r-0 border-b-2'>
        <input
          className='bg-input rounded-md selected:text-foreground p-3 text-foreground bg-input w-full rounded-md focus:border-focus border-2 border-foreground/0 transition-all selected:text-foreground placeholder:text-foreground/60'
          type='text'
          onChange={e => setSearch(e.target.value)}
          placeholder={t('Search groups by keyword')}
          value={search}
        />
      </div>
      <div className='flex flex-col gap-4 w-full'>
        {!pending && groups.length === 0 ? <NoPosts message={t('No results for this search')} /> : ''}
        {groups.map(group => {
          const expanded = selectedGroupSlug === group.slug
          return (
            <GroupCard
              memberships={membershipGroupIds}
              className={cn(classes.cardItem, { [classes.expanded]: expanded })}
              expanded={expanded}
              group={group}
              key={group.id}
            />
          )
        })}
      </div>
      <ScrollListener
        onBottom={loadMore}
        elementId={CENTER_COLUMN_ID}
        padding={350}
      />
      {pending && <Loading />}
      {(!hasMore && !!offset) && <div className={classes.noMoreResults}>{t('No more results')}</div>}
    </>
  )
}

const sortOptions = (t, nearCoord) => {
  const options = [
    { id: SORT_NAME, label: t('Group Name') },
    { id: SORT_SIZE, label: t('Member Count') }
  ]

  if (nearCoord) {
    options.push({ id: SORT_NEAREST, label: t('Nearest') })
  }

  return options
}

const makeDropdown = ({ selected, options, onChange, filterLabel = '', isFilter = false, t }) => {
  const selectedLabel = selected ? options.find(o => o.id === selected).label : t('All')
  return (
    <Dropdown
      id='group-search-sort-dropdown'
      alignRight={!isFilter}
      className='relative'
      toggleChildren={
        <button className='flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-background hover:bg-background/80 rounded-md border border-foreground/20 transition-colors'>
          {filterLabel}
          <span className='font-bold'>{selectedLabel}</span>
          <Icon name='ArrowDown' className='w-4 h-4 text-foreground/60' />
        </button>
      }
      items={options.map(({ id, label }) => ({
        label: t(label),
        onClick: () => onChange(id),
        className: 'px-4 py-2 text-sm text-foreground hover:bg-background/80 cursor-pointer'
      }))}
      menuClassName='absolute right-0 mt-1 py-1 bg-background border border-foreground/20 rounded-md shadow-lg z-50 min-w-[200px]'
    />
  )
}

function convertListValueKeyToId (arrayOfObjects) {
  return arrayOfObjects.map(object => {
    return {
      ...object,
      id: object.value
    }
  })
}
