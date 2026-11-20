import { HeartHandshake, Search, Trash2, Users } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import Loading from 'components/Loading'
import findMentions from 'store/actions/findMentions'
import {
  fetchSupporterGrants,
  grantSupporterStatus,
  revokeSupporterStatus,
  searchGroupsForSupporterGrant
} from 'store/actions/supportHylo'
import { endOfDayIso } from 'util/dateFormat'
import { cn } from 'util/index'

const inputClass = 'w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary'

function formatDate (value) {
  if (!value) return ''
  const date = new Date(value)
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString()
}

function Avatar ({ url, name, icon: IconComponent = Users }) {
  return url
    ? <img src={url} alt={name} className='w-8 h-8 rounded-full object-cover' />
    : <div className='w-8 h-8 rounded-full bg-foreground/20 flex items-center justify-center'><IconComponent className='w-4 h-4' /></div>
}

/**
 * /management/supporters (#1754): Hylo staff give supporter status to a person
 * or a group for non-monetary contributions, see who has it and revoke it.
 * It counts exactly like a qualifying Open Collective contribution; the person
 * or group still chooses whether to show the badge.
 */
export default function Supporters () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [targetType, setTargetType] = useState('person')
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [note, setNote] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [grants, setGrants] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const loadGrants = useCallback(() => {
    return dispatch(fetchSupporterGrants())
      .then(res => setGrants(res?.payload?.data?.supporterGrants || []))
      .catch(() => {
        setGrants([])
        setError(t('Could not load supporters'))
      })
  }, [dispatch])

  useEffect(() => { loadGrants() }, [loadGrants])

  const handleSearch = async value => {
    setSearchTerm(value)
    setSelected(null)
    if (!value || value.length < 2) {
      setResults([])
      return
    }
    try {
      if (targetType === 'person') {
        const res = await dispatch(findMentions({ autocomplete: value, maxItems: 10 }))
        setResults(res?.payload?.data?.people?.items || [])
      } else {
        const res = await dispatch(searchGroupsForSupporterGrant(value))
        setResults(res?.payload?.data?.groups?.items || [])
      }
    } catch (e) {
      setResults([])
    }
  }

  const switchTarget = type => {
    setTargetType(type)
    setSearchTerm('')
    setResults([])
    setSelected(null)
  }

  const handleGrant = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await dispatch(grantSupporterStatus({
        userId: targetType === 'person' ? selected.id : null,
        groupId: targetType === 'group' ? selected.id : null,
        note,
        // End of the chosen day, so "until 31 Dec" includes the 31st
        expiresAt: endOfDayIso(expiresAt)
      }))
      setSelected(null)
      setSearchTerm('')
      setResults([])
      setNote('')
      setExpiresAt('')
      await loadGrants()
    } catch (e) {
      setError(e?.message || t('Could not save'))
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async grant => {
    const name = grant.user?.name || grant.group?.name
    if (!window.confirm(t('Remove supporter status from {{name}}?', { name }))) return
    try {
      await dispatch(revokeSupporterStatus(grant.id))
      setGrants(prev => prev.filter(g => g.id !== grant.id))
    } catch (e) {
      setError(e?.message || t('Could not save'))
    }
  }

  return (
    <div className='p-6 max-w-4xl mx-auto' data-testid='management-supporters'>
      <h1 className='text-2xl font-bold mb-2 flex items-center gap-2'>
        <HeartHandshake className='w-6 h-6 text-pink-500' aria-hidden='true' />
        {t('Supporters')}
      </h1>
      <p className='text-foreground/70 mb-6'>
        {t('Give supporter status for non-monetary contributions. It counts like an Open Collective contribution, and people and groups still choose whether to show the badge.')}
      </p>

      <section className='mb-8 rounded-xl border border-foreground/20 p-4'>
        <h2 className='text-lg font-semibold mt-0 mb-4'>{t('Give supporter status')}</h2>
        <div className='flex gap-2 mb-3' role='radiogroup' aria-label={t('Give supporter status to')}>
          {[['person', t('A person')], ['group', t('A group')]].map(([value, label]) => (
            <button
              key={value}
              type='button'
              role='radio'
              aria-checked={targetType === value}
              onClick={() => switchTarget(value)}
              className={cn('rounded-md border-2 px-3 py-1 text-sm', targetType === value ? 'border-selected bg-selected/20' : 'border-foreground/20')}
            >
              {label}
            </button>
          ))}
        </div>

        {selected
          ? (
            <div className='flex items-center justify-between gap-3 rounded-md border border-foreground/20 p-2 mb-3' data-testid='supporter-selected'>
              <div className='flex items-center gap-3'>
                <Avatar url={selected.avatarUrl} name={selected.name} />
                <span className='font-medium'>{selected.name}</span>
              </div>
              <button type='button' className='text-sm text-foreground/60 hover:text-foreground' onClick={() => setSelected(null)}>{t('Change')}</button>
            </div>
            )
          : (
            <div className='relative mb-3'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 w-5 h-5' />
              <input
                type='text'
                data-testid='supporter-search'
                placeholder={targetType === 'person' ? t('Search for a person by name...') : t('Search for a group by name...')}
                value={searchTerm}
                onChange={e => handleSearch(e.target.value)}
                className={cn(inputClass, 'pl-10')}
              />
              {searchTerm.length >= 2 && (
                <ul className='mt-2 p-2 border border-foreground/20 rounded-md bg-card max-h-60 overflow-y-auto'>
                  {results.length === 0
                    ? <li className='list-none p-2 text-foreground/50 text-center'>{t('No results')}</li>
                    : results.map(item => (
                      <li key={item.id} className='list-none'>
                        <button
                          type='button'
                          onClick={() => setSelected(item)}
                          className='w-full p-2 hover:bg-foreground/10 rounded flex items-center gap-3 text-left'
                        >
                          <Avatar url={item.avatarUrl} name={item.name} />
                          <span>{item.name}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
            )}

        <label className='block mb-3 text-sm'>
          <span className='block mb-1 font-medium'>{t('Note (optional)')}</span>
          <input
            type='text'
            data-testid='supporter-note'
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('e.g. Translated Hylo into Portuguese')}
            className={inputClass}
          />
        </label>
        <label className='block mb-4 text-sm'>
          <span className='block mb-1 font-medium'>{t('Expires (optional)')}</span>
          <input
            type='date'
            data-testid='supporter-expires'
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            className={cn(inputClass, 'max-w-xs')}
          />
        </label>
        {error && <p className='text-destructive text-sm' role='alert'>{error}</p>}
        <button
          type='button'
          data-testid='supporter-grant'
          disabled={!selected || saving}
          onClick={handleGrant}
          className='rounded-md bg-selected px-4 py-2 text-sm font-semibold hover:bg-selected/90 disabled:opacity-50'
        >
          {t('Give supporter status')}
        </button>
      </section>

      <section>
        <h2 className='text-lg font-semibold mb-4'>{t('Supporter status given by the Hylo team')}</h2>
        {grants === null
          ? <Loading />
          : grants.length === 0
            ? <div className='text-foreground/50 p-4 border border-foreground/20 rounded-md'>{t('No one has been given supporter status yet.')}</div>
            : (
              <ul className='divide-y divide-foreground/10 border border-foreground/20 rounded-md p-0 m-0' data-testid='supporter-grants'>
                {grants.map(grant => {
                  const target = grant.user || grant.group
                  return (
                    <li key={grant.id} className='list-none p-4 flex items-center justify-between gap-3' data-testid='supporter-grant-row'>
                      <div className='flex items-center gap-3 min-w-0'>
                        <Avatar url={target?.avatarUrl} name={target?.name} />
                        <div className='min-w-0'>
                          <div className='font-medium'>
                            {target?.name}
                            <span className='ml-2 text-xs text-foreground/50'>{grant.group ? t('Group') : t('Person')}</span>
                          </div>
                          {grant.note && <div className='text-sm text-foreground/70 truncate'>{grant.note}</div>}
                          <div className='text-xs text-foreground/50'>
                            {t('Given by {{name}} on {{date}}', { name: grant.grantedBy?.name || t('Unknown'), date: formatDate(grant.createdAt) })}
                            {' · '}
                            {grant.expiresAt ? t('Until {{date}}', { date: formatDate(grant.expiresAt) }) : t('No expiry')}
                          </div>
                        </div>
                      </div>
                      <button
                        type='button'
                        onClick={() => handleRevoke(grant)}
                        className='p-2 text-destructive hover:bg-destructive/10 rounded'
                        title={t('Remove supporter status')}
                        aria-label={t('Remove supporter status')}
                      >
                        <Trash2 className='w-5 h-5' />
                      </button>
                    </li>
                  )
                })}
              </ul>
              )}
      </section>
    </div>
  )
}
