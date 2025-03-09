import React from 'react'
import { useTranslation } from 'react-i18next'
import classes from './Affiliation.module.scss'
import { cn } from 'util/index'

export default function Affiliation ({ affiliation, index, archive }) {
  const { role, preposition, orgName, url } = affiliation
  const { t } = useTranslation()

  const leave = () => {
    if (window.confirm(t('Are you sure you want to delete your affiliation as {{affiliation.role}} {{affiliation.preposition}} {{affiliation.orgName}}?', { affiliation }))) {
      archive(affiliation.id)
    }
  }

  return (
    <div className={cn('rounded-lg bg-black/10 flex transition-all text-foreground items-center align-center px-5 h-[40px] opacity-80 hover:opacity-100 scale-100 hover:scale-105 hover:bg-black/20 flex gap-1 hover:cursor-pointer')}>
      <div className={classes.role}>{role}</div>
      <div>{preposition}</div>
      <div className={classes.orgName}>{url ? (<a href={url} target='new'>{orgName}</a>) : orgName}</div>

      {archive && <span onClick={leave} className={classes.leaveButton}>{t('Delete')}</span>}
    </div>
  )
}
