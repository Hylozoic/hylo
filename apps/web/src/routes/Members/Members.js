import { debounce, get, isEmpty, some } from 'lodash/fp'
import React, { useEffect, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import { Link, useParams, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import Button from 'components/Button'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Member from 'components/Member'
import ScrollListener from 'components/ScrollListener'
import SwitchStyled from 'components/SwitchStyled'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from 'store/constants'
import { queryParamWhitelist } from 'store/reducers/queryResults'
import { groupUrl } from '@hylo/navigation'
import { FETCH_MEMBERS, fetchMembers, getMembers, getHasMoreMembers, removeMember } from './Members.store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'

import classes from './Members.module.scss'

const defaultSortBy = 'name'

function Members (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useParams()
  const location = useLocation()

  const context = props.context
  const slug = routeParams.groupSlug

  // State selectors
  const group = useSelector(state => getGroupForSlug(state, slug))
  const sortBy = getQuerystringParam('s', location) || defaultSortBy
  const search = getQuerystringParam('q', location)
  const memberCount = useSelector(state => get('memberCount', group))
  const members = useSelector(state => getMembers(state, { slug, search, sortBy }))
  const hasMore = useSelector(state => getHasMoreMembers(state, { slug, search, sortBy }))
  const pending = useSelector(state => state.pending[FETCH_MEMBERS])
  const myResponsibilities = useSelector(state => getResponsibilitiesForGroup(state, { groupId: group.id }))
  const myResponsibilityTitles = useMemo(() => myResponsibilities.map(r => r.title), [myResponsibilities])
  const canSeeJoinAnswers = useMemo(() =>
    myResponsibilityTitles.includes(RESP_ADMINISTRATION) || myResponsibilityTitles.includes(RESP_ADD_MEMBERS),
  [myResponsibilityTitles])

  const [showAnswers, setShowAnswers] = useState(false)

  // Action creators
  const changeSearch = useCallback(term =>
    dispatch(changeQuerystringParam(location, 'q', term)), [location])
  const changeSort = useCallback(sort =>
    dispatch(changeQuerystringParam(location, 's', sort, 'name')), [location])
  const removeMemberAction = useCallback((id) => {
    // We pass slug and group.id because slug is needed to optimistically update the query results, which are based on slug
    // TODO: ideally switch removeMember to also use slug so we dont need to pass in group.id too
    dispatch(removeMember(id, group.id, slug))
  }, [group.id, slug])
  const fetchMembersAction = useCallback((offset = 0) =>
    dispatch(fetchMembers({ slug, groupId: group.id, sortBy, offset, search })), [dispatch, slug, group.id, sortBy, search])

  useEffect(() => {
    if (isEmpty(members) && hasMore !== false) fetchMembersAction()
  }, [members, hasMore, fetchMembersAction])

  useEffect(() => {
    if (some(key => queryParamWhitelist.includes(key), [sortBy, search])) {
      fetchMembersAction()
    }
  }, [sortBy, search, fetchMembersAction])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Member Directory'),
      icon: '',
      info: '',
      search: true
    })
  }, [t])

  const fetchMore = () => {
    if (pending || members.length === 0 || !hasMore) return
    fetchMembersAction(members.length)
  }

  const debouncedSearch = debounce(300, changeSearch)

  const sortKeys = sortKeysFactory(context) // You might need to adjust this based on your needs

  return (
    <div className='h-auto max-w-[750px] mx-auto' id='members-page'>
      <Helmet>
        <title>{t('Members')} | {group ? `${group.name} | ` : ''}Hylo</title>
      </Helmet>
      {myResponsibilityTitles.includes(RESP_ADD_MEMBERS) && (
        <div className='flex items-center justify-between p-2'>
          <Link to={groupUrl(slug, 'settings/invite')}>
            <Button
              className={classes.invite}
              color='green-white-green-border'
              narrow
            >
              <Icon name='Invite' className={classes.inviteIcon} /> {t('Invite People')}
            </Button>
          </Link>
        </div>
      )}
      <div className={classes.content}>
        <div className='flex items-center gap-2 py-4'>
          <input
            placeholder={t('Search {{memberCount}} members by name or skills & interests', { memberCount })}
            className='bg-input/60 focus:bg-input/100 rounded-lg text-foreground placeholder-foreground/40 w-full p-2 transition-all outline-none focus:outline-focus focus:outline-2'
            defaultValue={search}
            onChange={e => debouncedSearch(e.target.value)}
          />
          <Dropdown
            id='members-sort-dropdown'
            className='border-2 border-foreground/20 rounded-lg p-2 text-foreground/100'
            toggleChildren={<SortLabel text={sortKeys[sortBy]} />}
            alignRight
            items={Object.keys(sortKeys).map(k => ({
              label: t(sortKeys[k]),
              onClick: () => changeSort(k)
            }))}
          />
          {canSeeJoinAnswers && (
            <div className='flex items-center gap-2'>
              <SwitchStyled
                checked={showAnswers}
                onChange={() => setShowAnswers(!showAnswers)}
                backgroundColor={showAnswers ? '#0DC39F' : '#8B96A4'}
              />
              <span className='text-sm font-medium text-foreground/80'>{t('Show Answers')}</span>
            </div>
          )}
        </div>
        <div className='flex flex-col gap-2'>
          {members.map(member => (
            <Member
              group={group}
              removeMember={removeMemberAction}
              member={member}
              key={member.id}
              context={context}
              canSeeJoinAnswers={canSeeJoinAnswers}
              showAnswers={showAnswers}
            />
          ))}
        </div>
      </div>
      <ScrollListener
        onBottom={fetchMore}
        elementId='center-column'
      />
    </div>
  )
}

function SortLabel ({ text }) {
  const { t } = useTranslation()
  return (
    <div className='flex items-center w-fit gap-1 text-foreground/70 text-sm'>
      <span className='whitespace-nowrap'>{t('Sort by')} <strong>{text}</strong></span>
      <Icon name='ArrowDown' />
    </div>
  )
}

function sortKeysFactory (context) {
  // TODO: why are we passing in context here?
  const sortKeys = {
    name: 'Name',
    location: 'Location'
  }
  return sortKeys
}

export default Members
