import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import Loading from 'components/Loading'

function BlockedUsersTab ({ blockedUsers, unBlockUser, loading }) {
  const { t } = useTranslation()

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Blocked Users'),
      icon: '',
      info: '',
      search: false
    })
  }, [])

  if (loading) return <Loading />

  return (
    <div>
      {blockedUsers && blockedUsers.map(blockedUser =>
        <UnBlockUserControl
          blockedUser={blockedUser}
          unBlockUser={unBlockUser}
          key={blockedUser.id}
        />)}
      {(!blockedUsers || blockedUsers.length === 0) && (
        <div className='text-foreground'>{t('No blocked users')}</div>
      )}
    </div>
  )
}

export function UnBlockUserControl ({ blockedUser, unBlockUser }) {
  const unBlockUserFun = () => unBlockUser(blockedUser.id)
  const { t } = useTranslation()

  return (
    <div className='flex items-center justify-between py-2 border-b border-foreground/10'>
      <div className='text-base text-foreground leading-[22px]'>{blockedUser.name}</div>
      <button
        type='button'
        onClick={unBlockUserFun}
        className='text-sm font-medium text-destructive hover:text-destructive/80 transition-colors cursor-pointer'
      >
        {t('Unblock')}
      </button>
    </div>
  )
}

export default BlockedUsersTab
