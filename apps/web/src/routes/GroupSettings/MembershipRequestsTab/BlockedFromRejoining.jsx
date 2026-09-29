import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { toast } from 'sonner'
import { Ban } from 'lucide-react'
import { personUrl } from '@hylo/navigation'
import Avatar from 'components/Avatar'
import Button from 'components/ui/button'
import { formatLocalizedDate } from 'util/dateFormat'
import { fetchBlockedFromRejoining, liftGroupBan } from './MembershipRequestsTab.store'

/**
 * The people a steward removed from this group and blocked from rejoining (D60), with a
 * button to lift each block. Shows nothing when nobody is blocked, or to anyone who can't
 * add or remove members (the server lists nobody for them).
 */
export default function BlockedFromRejoining ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [blocked, setBlocked] = useState([])
  const [lifting, setLifting] = useState(null)

  useEffect(() => {
    if (!group?.id) return
    let cancelled = false
    Promise.resolve(dispatch(fetchBlockedFromRejoining(group.id)))
      .then(result => {
        if (!cancelled) setBlocked(result?.payload?.data?.group?.blockedFromRejoining || [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [dispatch, group?.id])

  const lift = useCallback(async person => {
    setLifting(person.id)
    try {
      await dispatch(liftGroupBan(person.id, group.id))
      setBlocked(current => current.filter(ban => ban.person.id !== person.id))
    } catch (error) {
      toast.error(t('There was an error, please try again.'))
    } finally {
      setLifting(null)
    }
  }, [dispatch, group?.id, t])

  if (blocked.length === 0) return null

  return (
    <div className='space-y-3' data-testid='blocked-from-rejoining'>
      <div className='flex items-center gap-2'>
        <Ban className='w-4 h-4 text-foreground/70' />
        <h2 className='text-foreground font-bold m-0'>{t('Blocked from rejoining')}</h2>
      </div>
      <p className='text-foreground/70 text-sm m-0'>
        {t("These people were removed and can't come back through the join link, an invitation or a request until the block is lifted.")}
      </p>
      {blocked.map(ban => (
        <div key={ban.id} className='bg-card p-3 rounded-lg flex items-center gap-3'>
          <Avatar avatarUrl={ban.person.avatarUrl} url={personUrl(ban.person.id)} className='w-10 h-10 rounded-full shrink-0' />
          <div className='flex-1 min-w-0'>
            <div className='font-medium text-foreground truncate'>{ban.person.name}</div>
            {ban.createdAt && (
              <div className='text-xs text-foreground/50'>
                {t('Blocked {{date}}', { date: formatLocalizedDate(ban.createdAt, { style: 'short' }) })}
              </div>
            )}
          </div>
          <Button
            variant='outline'
            onClick={() => lift(ban.person)}
            disabled={lifting === ban.person.id}
            data-testid='lift-block'
          >
            {t('Lift block')}
          </Button>
        </div>
      ))}
    </div>
  )
}
