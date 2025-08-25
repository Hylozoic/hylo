import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import classes from './BlockedUsersTab.module.scss'
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
      {(!blockedUsers || blockedUsers.length === 0) && <div className={classes.noBlockedUsers}>{t('No blocked users')}</div>}
    </div>
  )
}

export function UnBlockUserControl ({ blockedUser, unBlockUser }) {
  const unBlockUserFun = () => unBlockUser(blockedUser.id)
  const { t } = useTranslation()

  return (
    <div className={classes.unblockUserControl}>
      <div className={classes.row}>
        <div className={classes.name}>{blockedUser.name}</div>
        <div onClick={unBlockUserFun} className={classes.unblockButton}>{t('Unblock')}</div>
      </div>
    </div>
  )
}

export default BlockedUsersTab
