import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'
import classes from './Affiliation.module.scss'

export default function Affiliation ({ affiliation, index, archive }) {
  const { role, preposition, orgName, url } = affiliation
  const { t } = useTranslation()

  const leave = () => {
    if (window.confirm(t('Are you sure you want to delete your affiliation as {{affiliation.role}} {{affiliation.preposition}} {{affiliation.orgName}}?', { affiliation }))) {
      archive(affiliation.id)
    }
  }

  return (
    <div className={cn('rounded-lg bg-black/10 flex transition-all text-foreground items-center align-center px-5 h-[40px] mx-2 opacity-80 hover:opacity-100 scale-100 hover:scale-105 hover:bg-black/20 flex gap-1 mb-2', index % 2 === 0 ? 'bg-black/5' : 'bg-black/10')} >
      <div className={classes.role}>{role}</div>
      <div>{preposition}</div>
      <div className={classes.orgName}>{url ? (<a href={url} target='new'>{orgName}</a>) : orgName}</div>

      {archive && <span onClick={leave} className={classes.leaveButton}>{t('Delete')}</span>}
    </div>
  )
}
