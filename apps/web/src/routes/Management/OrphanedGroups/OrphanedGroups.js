import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { groupUrl } from '@hylo/navigation'
import Loading from 'components/Loading'
import Button from 'components/ui/button'
import { Input } from 'components/ui/input'

const PAGE_SIZE = 20

export function fetchOrphanedGroups ({ first = PAGE_SIZE, offset = 0 } = {}) {
  return {
    type: 'FETCH_ORPHANED_GROUPS',
    graphql: {
      query: `query OrphanedGroups ($first: Int, $offset: Int) {
        orphanedGroups(first: $first, offset: $offset) {
          total
          hasMore
          items {
            id
            name
            slug
            avatarUrl
            createdAt
            memberCount
            lastActivityAt
            candidates { id name avatarUrl roleName }
          }
        }
      }`,
      variables: { first, offset }
    }
  }
}

export function searchOrphanedGroupMembers (groupId, search) {
  return {
    type: 'SEARCH_ORPHANED_GROUP_MEMBERS',
    graphql: {
      query: `query OrphanedGroupMembers ($groupId: ID!, $search: String) {
        orphanedGroupMembers(groupId: $groupId, search: $search) { id name avatarUrl roleName }
      }`,
      variables: { groupId, search }
    }
  }
}

export function assignOrphanedGroupAdministrator (groupId, personId) {
  return {
    type: 'ASSIGN_ORPHANED_GROUP_ADMINISTRATOR',
    graphql: {
      query: `mutation AssignOrphanedGroupAdministrator ($groupId: ID!, $personId: ID!) {
        assignOrphanedGroupAdministrator(groupId: $groupId, personId: $personId) { success error }
      }`,
      variables: { groupId, personId }
    }
  }
}

function formatDate (value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString()
}

function PersonRow ({ person, onChoose, disabled }) {
  const { t } = useTranslation()
  return (
    <li className='flex items-center justify-between gap-3 py-1'>
      <span className='flex items-center gap-2 min-w-0'>
        {person.avatarUrl
          ? <img src={person.avatarUrl} alt='' className='w-6 h-6 rounded-full shrink-0' />
          : <span className='w-6 h-6 rounded-full bg-foreground/20 shrink-0' />}
        <span className='truncate text-foreground'>{person.name}</span>
        {person.roleName && <span className='text-xs text-foreground-muted shrink-0'>{t(person.roleName)}</span>}
      </span>
      <Button variant='outline' size='sm' disabled={disabled} onClick={() => onChoose(person)}>
        {t('Make Administrator')}
      </Button>
    </li>
  )
}

function OrphanedGroupCard ({ group, onAssigned }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    let active = true
    const timeout = setTimeout(() => {
      Promise.resolve(dispatch(searchOrphanedGroupMembers(group.id, term)))
        .then(result => { if (active) setResults(result?.payload?.data?.orphanedGroupMembers || []) })
        .catch(() => { if (active) setResults([]) })
    }, 300)
    return () => { active = false; clearTimeout(timeout) }
  }, [search, group.id, dispatch])

  const choose = useCallback(person => {
    if (!window.confirm(t('Make {{name}} the Administrator of {{group}}?', { name: person.name, group: group.name }))) return
    setAssigning(true)
    setError(null)
    Promise.resolve(dispatch(assignOrphanedGroupAdministrator(group.id, person.id)))
      .then(result => {
        if (result?.error || !result?.payload?.data?.assignOrphanedGroupAdministrator?.success) throw result?.payload || new Error('failed')
        onAssigned(group, person)
      })
      .catch(() => setError(t('There was an error, please try again.')))
      .finally(() => setAssigning(false))
  }, [dispatch, group, onAssigned, t])

  const lastActivity = formatDate(group.lastActivityAt)

  return (
    <li className='border border-foreground/20 rounded-md p-4' data-testid='orphaned-group'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <Link to={groupUrl(group.slug)} className='font-semibold text-foreground hover:underline'>{group.name}</Link>
          <div className='text-sm text-foreground-muted'>
            {t('Members: {{count}}', { count: group.memberCount })}
            {' · '}
            {lastActivity ? t('Last post: {{date}}', { date: lastActivity }) : t('No posts yet')}
            {group.createdAt && <>{' · '}{t('Created {{date}}', { date: formatDate(group.createdAt) })}</>}
          </div>
        </div>
      </div>

      <h3 className='text-sm font-semibold mt-3 mb-1'>{t('Moderators and Hosts')}</h3>
      {group.candidates?.length > 0
        ? (
          <ul className='list-none p-0 m-0'>
            {group.candidates.map(person => (
              <PersonRow key={`${person.id}-${person.roleName}`} person={person} onChoose={choose} disabled={assigning} />
            ))}
          </ul>
          )
        : <p className='text-sm text-foreground-muted m-0'>{t('None')}</p>}

      <h3 className='text-sm font-semibold mt-3 mb-1'>{t('Find another member')}</h3>
      <Input
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder={t("Search this group's members")}
        aria-label={t("Search this group's members")}
      />
      {results.length > 0 && (
        <ul className='list-none p-0 m-0 mt-2'>
          {results.map(person => (
            <PersonRow key={person.id} person={person} onChoose={choose} disabled={assigning} />
          ))}
        </ul>
      )}
      {error && <p className='text-sm text-destructive mt-2 mb-0'>{error}</p>}
    </li>
  )
}

/**
 * Hylo staff page listing groups that still have members but no active
 * Administrator, where staff can make one of the members its Administrator.
 */
export default function OrphanedGroups () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [groups, setGroups] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback((offset = 0) => {
    setLoading(true)
    return Promise.resolve(dispatch(fetchOrphanedGroups({ offset })))
      .then(result => {
        const list = result?.payload?.data?.orphanedGroups
        if (!list) throw result?.payload || new Error('failed')
        setGroups(current => offset === 0 ? list.items : [...current, ...list.items])
        setTotal(list.total)
        setHasMore(list.hasMore)
        setError(null)
      })
      .catch(() => setError(t('There was an error, please try again.')))
      .finally(() => setLoading(false))
  }, [dispatch, t])

  useEffect(() => { load(0) }, [load])

  const handleAssigned = useCallback((group, person) => {
    setGroups(current => current.filter(item => item.id !== group.id))
    setTotal(current => Math.max(0, current - 1))
    setNotice(t('{{name}} is now the Administrator of {{group}}.', { name: person.name, group: group.name }))
  }, [t])

  return (
    <div className='p-6 max-w-4xl mx-auto'>
      <h1 className='text-2xl font-bold mb-2'>{t('Groups without an Administrator')}</h1>
      <p className='text-foreground/70 mb-6'>
        {t('These groups still have members, but nobody who can run them. Choose a member to make their Administrator.')}
      </p>
      {notice && <p className='text-sm text-foreground bg-selected/20 rounded-md p-3' role='status'>{notice}</p>}
      {error && <p className='text-sm text-destructive' role='alert'>{error}</p>}
      {!loading && !error && groups.length === 0 && (
        <p className='text-foreground-muted p-4 border border-foreground/20 rounded-md'>{t('No groups are missing an Administrator.')}</p>
      )}
      {groups.length > 0 && (
        <>
          <p className='text-sm text-foreground-muted'>{t('Showing {{shown}} of {{total}}', { shown: groups.length, total })}</p>
          <ul className='list-none p-0 m-0 flex flex-col gap-3'>
            {groups.map(group => <OrphanedGroupCard key={group.id} group={group} onAssigned={handleAssigned} />)}
          </ul>
        </>
      )}
      {loading && <Loading />}
      {!loading && hasMore && (
        <Button variant='outline' className='mt-4' onClick={() => load(groups.length)}>{t('Load more')}</Button>
      )}
    </div>
  )
}
