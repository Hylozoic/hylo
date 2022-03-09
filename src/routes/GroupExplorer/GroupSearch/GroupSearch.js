import React, { useState, useEffect } from 'react'
import cx from 'classnames'
import { useSelector } from 'react-redux'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import NoPosts from 'components/NoPosts'
import ScrollListener from 'components/ScrollListener'
import GroupCard from 'components/GroupCard'
import useRouter from 'hooks/useRouter'
import useDebounce from 'hooks/useDebounce'
import useEnsureSearchedGroups from 'hooks/useEnsureSearchedGroups'
import getMe from 'store/selectors/getMe'
import { SORT_NAME, SORT_NEAREST, SORT_SIZE } from 'store/constants'
import { CENTER_COLUMN_ID } from 'util/scrolling'
import { ALL_VIEW, FARM_VIEW, FARM_TYPES, PRODUCT_CATAGORIES, MANAGEMENT_PLANS, FARM_CERTIFICATIONS } from 'util/constants'
import './GroupSearch.scss'

export default function GroupSearch ({ viewFilter }) {
  const currentUser = useSelector(state => getMe(state))
  const nearCoord = currentUser.locationObject ? { lng: parseFloat(currentUser.locationObject.center.lng), lat: parseFloat(currentUser.locationObject.center.lat) } : null
  const membershipGroupIds = currentUser.memberships.toModelArray().map(membership => membership.group.id)
  const [sortBy, setSortBy] = useState(SORT_NAME)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [filterToggle, setFilterToggle] = useState(false)
  const [groupType, setGroupType] = useState(null)
  const [farmType, setFarmType] = useState(null)
  const [certOrManagementPlan, setCertOrManagementPlan] = useState(null)
  const [productCategories, setProductCategories] = useState(null)
  const debouncedSearchTerm = useDebounce(search, 500)
  const { query } = useRouter()
  const selectedGroupSlug = query.groupSlug
  const [farmQuery, setFarmQuery] = useState({ farmType, certOrManagementPlan, productCategories })
  const { groups = [], pending = false, fetchMoreGroups, hasMore } = useEnsureSearchedGroups({ sortBy, search: debouncedSearchTerm, offset, nearCoord, visibility: [3], groupType, farmQuery })

  useEffect(() => {
    setOffset(0)
  }, [search, sortBy, groupType])

  useEffect(() => {
    setOffset(groups.length)
  }, [groups])

  useEffect(() => {
    if (viewFilter === FARM_VIEW) {
      setSortBy(SORT_NEAREST)
    }
  }, [viewFilter])

  useEffect(() => {
    setFarmQuery({ farmType, certOrManagementPlan, productCategories })
  }, [farmType, certOrManagementPlan, productCategories])

  useEffect(() => viewFilter === FARM_VIEW ? setGroupType(FARM_VIEW) : setGroupType(null), [viewFilter])

  return <React.Fragment>
    <div styleName='group-search-view-ctrls'>
      {viewFilter !== ALL_VIEW ? <div onClick={() => setFilterToggle(!filterToggle)}>filters</div> : <div id='div-left-intentionally-blank' />}
      { makeDropdown(sortBy, sortOptions(nearCoord), setSortBy, 'Sort by: ') }
    </div>
    {filterToggle && <div styleName='filter-list'>
      { makeDropdown(farmType, convertListValueKeyToId(FARM_TYPES), setFarmType, 'Farm Type: ', true) }
      { makeDropdown(productCategories, convertListValueKeyToId(PRODUCT_CATAGORIES), setProductCategories, 'Operation: ', true) }
      { makeDropdown(certOrManagementPlan, convertListValueKeyToId(MANAGEMENT_PLANS.concat(FARM_CERTIFICATIONS)), setCertOrManagementPlan, 'Management Techniques: ', true) }
    </div>}
    <div styleName='search-input'>
      <div className='spacer' />
      <input
        styleName='searchBox'
        type='text'
        onChange={e => setSearch(e.target.value)}
        placeholder='Search groups by keyword'
        value={search}
      />
      <div className='spacer' />
    </div>
    <div styleName='group-search-items'>
      {!pending && groups.length === 0 ? <NoPosts message='No results for this search' /> : ''}
      {groups.map(group => {
        const expanded = selectedGroupSlug === group.slug
        return <GroupCard
          memberships={membershipGroupIds}
          styleName={cx({ 'card-item': true, expanded })}
          expanded={expanded}
          routeParams={query}
          group={group}
          key={group.id} />
      })}
    </div>
    <ScrollListener onBottom={() => fetchMoreGroups(offset)}
      elementId={CENTER_COLUMN_ID} />
    {pending && <Loading />}
    {(!hasMore && !!offset) && <div styleName='no-more-results'>No more results</div>}
  </React.Fragment>
}

const sortOptions = (nearCoord) => {
  let options = [
    { id: SORT_NAME, label: 'Group Name' },
    { id: SORT_SIZE, label: 'Member Count' }
  ]

  if (nearCoord) {
    options.push({ id: SORT_NEAREST, label: 'Nearest' })
  }

  return options
}

const makeDropdown = (selected, options, onChange, filterLabel = '', isFilter = false) => {
  const selectedLabel = selected ? options.find(o => o.id === selected).label : 'All'
  return (
    <Dropdown styleName={cx({ 'dropdown': true, 'filter-dropdown': isFilter })}
      toggleChildren={<span styleName={isFilter ? 'filter-dropdown-label' : 'dropdown-label'}>
        {!isFilter && <Icon name='ArrowDown' />}
        {isFilter
          ? <div>{filterLabel}<b>{selectedLabel}</b></div>
          : <span>{filterLabel}<b>{selectedLabel}</b></span>
        }
        {isFilter && <Icon name='ArrowDown' />}
      </span>}
      items={options.map(({ id, label }) => ({
        label,
        onClick: () => onChange(id)
      }))} />)
}

function convertListValueKeyToId (arrayOfObjects) {
  return arrayOfObjects.map(object => {
    return {
      ...object,
      id: object.value
    }
  })
}
