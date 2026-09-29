import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { AnalyticsEvents } from '@hylo/shared'
import Button from 'components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'components/ui/dialog'
import { Input } from 'components/ui/input'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import getMe from 'store/selectors/getMe'
import { fetchStewardSuggestions } from 'routes/GroupSettings/RolesSettingsTab/RolesSettingsTab.store'
import { handOffAdministrator, useSoleAdministratorGroups } from './soleAdministratorGroups'

const SEARCH_DEBOUNCE = 300

/**
 * Search the group's members and make one of them an Administrator. `surface`
 * says where it was used ('leave' or 'close') for analytics. Calls
 * onHandedOff(person) once the role is given.
 */
export function HandOffPicker ({ group, surface, onHandedOff }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const me = useSelector(getMe)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const term = search.trim()
    if (!term) {
      setResults([])
      return
    }
    let active = true
    const timeout = setTimeout(() => {
      Promise.resolve(dispatch(fetchStewardSuggestions(group.id, term)))
        .then(result => {
          if (!active) return
          const members = result?.payload?.data?.group?.members?.items || []
          setResults(members.filter(person => String(person.id) !== String(me?.id)))
        })
        .catch(() => { if (active) setResults([]) })
    }, SEARCH_DEBOUNCE)
    return () => { active = false; clearTimeout(timeout) }
  }, [search, group.id, dispatch, me?.id])

  const choose = useCallback(person => {
    if (!window.confirm(t('Make {{name}} an Administrator of {{group}}?', { name: person.name, group: group.name }))) return
    setSaving(true)
    setError(null)
    Promise.resolve(dispatch(handOffAdministrator(group.id, person.id)))
      .then(result => {
        if (result?.error || !result?.payload?.data?.handOffAdministrator?.success) throw result?.payload || new Error('failed')
        dispatch(trackAnalyticsEvent(AnalyticsEvents.GROUP_ADMINISTRATOR_HANDED_OFF, { groupId: group.id, surface }))
        setSearch('')
        setResults([])
        onHandedOff && onHandedOff(person)
      })
      .catch(() => setError(t('There was an error, please try again.')))
      .finally(() => setSaving(false))
  }, [dispatch, group.id, group.name, onHandedOff, surface, t])

  return (
    <div className='flex flex-col gap-2' data-testid='hand-off-picker'>
      <Input
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder={t("Search this group's members")}
        aria-label={t("Search this group's members")}
      />
      {results.length > 0 && (
        <ul className='list-none p-0 m-0 flex flex-col gap-1 max-h-48 overflow-y-auto'>
          {results.map(person => (
            <li key={person.id} className='flex items-center justify-between gap-2'>
              <span className='flex items-center gap-2 min-w-0'>
                {person.avatarUrl
                  ? <img src={person.avatarUrl} alt='' className='w-6 h-6 rounded-full shrink-0' />
                  : <span className='w-6 h-6 rounded-full bg-foreground/20 shrink-0' />}
                <span className='truncate text-sm text-foreground'>{person.name}</span>
              </span>
              <Button variant='outline' size='sm' disabled={saving} onClick={() => choose(person)}>
                {t('Make Administrator')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className='text-sm text-destructive m-0'>{error}</p>}
    </div>
  )
}

/**
 * The confirmation shown before leaving a group. When the person is the only
 * Administrator of a top-level group it says so and offers to hand the role to
 * another member first; they can still leave either way.
 */
export default function SoleAdminLeaveDialog ({ open, onOpenChange, group, isSpace, title, description, confirmLabel, onConfirm, contentClassName }) {
  const { t } = useTranslation()
  const checkSoleAdministrator = !!open && !!group && !isSpace
  const { groups } = useSoleAdministratorGroups(checkSoleAdministrator)
  const [handedOffTo, setHandedOffTo] = useState(null)

  useEffect(() => {
    if (!open) setHandedOffTo(null)
  }, [open])

  const isSoleAdministrator = checkSoleAdministrator && !handedOffTo &&
    groups.some(soleGroup => String(soleGroup.id) === String(group.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className='text-foreground/70'>{description}</DialogDescription>
        </DialogHeader>
        {isSoleAdministrator && (
          <div className='rounded-lg bg-accent/10 p-3 flex flex-col gap-2' data-testid='sole-administrator-leave'>
            <h3 className='text-sm font-bold text-foreground m-0'>{t("You're the only Administrator")}</h3>
            <p className='text-sm text-foreground/70 m-0'>
              {t('Choose someone to take over before you go, so {{group}} still has someone to look after it. You can still leave without doing this.', { group: group.name })}
            </p>
            <HandOffPicker group={group} surface='leave' onHandedOff={setHandedOffTo} />
          </div>
        )}
        {handedOffTo && (
          <p className='text-sm text-foreground bg-selected/20 rounded-md p-3 m-0' role='status'>
            {t('{{name}} is now an Administrator of {{group}}.', { name: handedOffTo.name, group: group.name })}
          </p>
        )}
        <DialogFooter className='flex gap-2 mt-4'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button variant='destructive' onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
