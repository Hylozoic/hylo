import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Loading from 'components/Loading'
import Button from 'components/ui/button'

export function fetchDeletedGroups () {
  return {
    type: 'FETCH_DELETED_GROUPS',
    graphql: {
      query: `query DeletedGroups {
        deletedGroups {
          id
          groupId
          name
          slug
          avatarUrl
          deletedAt
          restorableUntil
          deletedByName
          memberCount
        }
      }`
    }
  }
}

export function restoreDeletedGroup (id) {
  return {
    type: 'RESTORE_DELETED_GROUP',
    graphql: {
      query: `mutation RestoreDeletedGroup ($id: ID!) {
        restoreDeletedGroup(id: $id) { success error }
      }`,
      variables: { id }
    }
  }
}

function formatDate (value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()
}

/**
 * Hylo staff page listing groups deleted in the last 30 days, each of which can
 * be restored with exactly the memberships it had.
 */
export default function DeletedGroups () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    Promise.resolve(dispatch(fetchDeletedGroups()))
      .then(result => {
        const list = result?.payload?.data?.deletedGroups
        if (!Array.isArray(list)) throw result?.payload || new Error('failed')
        setGroups(list)
      })
      .catch(() => setError(t('There was an error, please try again.')))
      .finally(() => setLoading(false))
  }, [dispatch, t])

  const restore = useCallback(deleted => {
    if (!window.confirm(t('Restore {{name}} and bring back its {{count}} members?', { name: deleted.name, count: deleted.memberCount }))) return
    setRestoring(deleted.id)
    setError(null)
    Promise.resolve(dispatch(restoreDeletedGroup(deleted.id)))
      .then(result => {
        if (result?.error || !result?.payload?.data?.restoreDeletedGroup?.success) throw result?.payload || new Error('failed')
        setGroups(current => current.filter(item => item.id !== deleted.id))
        setNotice(t('{{name}} has been restored.', { name: deleted.name }))
      })
      .catch(() => setError(t('There was an error, please try again.')))
      .finally(() => setRestoring(null))
  }, [dispatch, t])

  return (
    <div className='p-6 max-w-4xl mx-auto'>
      <h1 className='text-2xl font-bold mb-2'>{t('Deleted groups')}</h1>
      <p className='text-foreground/70 mb-6'>{t('Groups deleted in the last 30 days. Restoring one brings back the group and exactly the members it had, including in its spaces.')}</p>
      {notice && <p className='text-sm text-foreground bg-selected/20 rounded-md p-3' role='status'>{notice}</p>}
      {error && <p className='text-sm text-destructive' role='alert'>{error}</p>}
      {loading && <Loading />}
      {!loading && !error && groups.length === 0 && (
        <p className='text-foreground-muted p-4 border border-foreground/20 rounded-md'>{t('No deleted groups can be restored right now.')}</p>
      )}
      {groups.length > 0 && (
        <ul className='list-none p-0 m-0 flex flex-col gap-3'>
          {groups.map(deleted => (
            <li key={deleted.id} className='border border-foreground/20 rounded-md p-4 flex items-start justify-between gap-3' data-testid='deleted-group'>
              <div className='min-w-0'>
                <div className='font-semibold text-foreground'>{deleted.name}</div>
                <div className='text-sm text-foreground-muted'>
                  {t('Deleted {{date}} by {{name}}', { date: formatDate(deleted.deletedAt), name: deleted.deletedByName || t('Unknown') })}
                  {' · '}
                  {t('Members: {{count}}', { count: deleted.memberCount })}
                  {' · '}
                  {t('Can be restored until {{date}}', { date: formatDate(deleted.restorableUntil) })}
                </div>
              </div>
              <Button variant='outline' size='sm' disabled={restoring === deleted.id} onClick={() => restore(deleted)}>
                {t('Restore')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
