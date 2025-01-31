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
import useRouteParams from 'hooks/useRouteParams'
import useDebounce from 'hooks/useDebounce'
import useEnsureSearchedGroups from 'hooks/useEnsureSearchedGroups'
import getMe from 'store/selectors/getMe'
import { SORT_NAME, SORT_NEAREST, SORT_SIZE } from 'store/constants'
import { CENTER_COLUMN_ID } from 'util/scrolling'
import { FARM_VIEW, FARM_TYPES, PRODUCT_CATEGORIES, MANAGEMENT_PLANS, FARM_CERTIFICATIONS } from 'util/constants'
import classes from './GroupSearch.module.scss'

const baseList = [{ value: '', label: 'All' }]

export default function GroupSearch ({ viewFilter }) {
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
    setOffset(groups.length)
  }, [groups])

  useEffect(() => {
    if (viewFilter === FARM_VIEW && nearCoord) {
      setSortBy(SORT_NEAREST)
    }
  }, [viewFilter])

  useEffect(() => viewFilter === FARM_VIEW ? setGroupType(FARM_VIEW) : setGroupType(null), [viewFilter])

  return (
    <>
      <div className={classes.groupSearchViewCtrls}>
        {viewFilter === FARM_VIEW
          ? (
            <div className={classes.filterContainer} onClick={() => setFilterToggle(!filterToggle)}>
              <Icon name='Filter' green={filterToggle} className={cn(classes.filterIcon, { [classes.filterOpen]: filterToggle })} />
              <b className={cn({ [classes.filterOpen]: filterToggle })}>{t('Filters')}</b>
              {filterToggle && <Icon name='Ex' className={classes.removeButton} />}
            </div>
            )
          : <div id='div-left-intentionally-blank' />}
        {makeDropdown({ selected: sortBy, options: sortOptions(t, nearCoord), onChange: setSortBy, filterLabel: `${t('Sort by')}: `, t })}
      </div>
      {filterToggle && viewFilter === FARM_VIEW &&
        <div className={classes.filterList}>
          {makeDropdown({ selected: farmQuery.farmType, options: convertListValueKeyToId(baseList.concat(FARM_TYPES)), onChange: (value) => setFarmQuery({ ...farmQuery, farmType: value }), filterLabel: t('Farm Type: '), isFilter: true, t })}
          {makeDropdown({ selected: farmQuery.productCategories, options: convertListValueKeyToId(baseList.concat(PRODUCT_CATEGORIES)), onChange: (value) => setFarmQuery({ ...farmQuery, productCategories: value }), filterLabel: t('Operation: '), isFilter: true, t })}
          {makeDropdown({ selected: farmQuery.certOrManagementPlan, options: convertListValueKeyToId(baseList.concat(MANAGEMENT_PLANS, FARM_CERTIFICATIONS)), onChange: (value) => setFarmQuery({ ...farmQuery, certOrManagementPlan: value }), filterLabel: t('Management Techniques: '), isFilter: true, t })}
        </div>}
      <div className={classes.searchInput}>
        <div className='spacer' />
        <input
          className={classes.searchBox}
          type='text'
          onChange={e => setSearch(e.target.value)}
          placeholder={t('Search groups by keyword')}
          value={search}
        />
        <div className='spacer' />
      </div>
      <div className={classes.groupSearchItems}>
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
        onBottom={() => fetchMoreGroups(offset)}
        elementId={CENTER_COLUMN_ID}
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
      alignRight={!isFilter}
      className={cn(classes.dropdown, { [classes.filterDropdown]: isFilter })}
      toggleChildren={
        <span className={isFilter ? classes.filterDropdownLabel : classes.dropdownLabel}>
          {!isFilter && <Icon name='ArrowDown' />}
          {isFilter
            ? <div>{filterLabel}<b>{selectedLabel}</b></div>
            : <span>{filterLabel}<b>{selectedLabel}</b></span>}
          {isFilter && <Icon name='ArrowDown' />}
        </span>
      }
      items={options.map(({ id, label }) => ({
        label: t(label),
        onClick: () => onChange(id)
      }))}
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
