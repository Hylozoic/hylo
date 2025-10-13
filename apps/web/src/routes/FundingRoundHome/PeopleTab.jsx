import React from 'react'
import { useTranslation } from 'react-i18next'
import { personUrl } from '@hylo/navigation'
import { Link } from 'react-router-dom'
import useRouteParams from 'hooks/useRouteParams'

export default function PeopleTab ({ round }) {
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const { users } = round

  return (
    <div>
      {users?.length === 0 && <h1>{t('No one has joined this round')}</h1>}
      {users?.length > 0 && (
        <div className='flex flex-col gap-2 pt-4'>
          {users?.map(user => (
            <div key={user.id} className='flex flex-row gap-2 items-center justify-between'>
              <div>
                <Link to={personUrl(user.id, routeParams.groupSlug)} className='flex flex-row gap-2 items-center text-foreground'>
                  <img src={user.avatarUrl} alt={user.name} className='w-10 h-10 rounded-full my-2' />
                  <span>{user.name}</span>
                </Link>
              </div>
              <div className='flex flex-row gap-4 items-center text-xs text-foreground/60'>
                <div>
                  <span>submission</span>
                </div>
                <div>
                  <span>submitter? voter?</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
