import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DEFAULT_AVATAR } from 'store/models/Group'
import RoundImage from 'components/RoundImage'
import classes from './RemovableListItem.module.scss'

export default function RemovableListItem ({ item, removeItem, skipConfirm = false, square, size, confirmMessage, url }) {
  const { t } = useTranslation()
  const remove = () => {
    if (skipConfirm) return removeItem(item.id)

    confirmMessage = confirmMessage || t('Are you sure you want to remove {{item}}?', { item: item.name || item.title })
    if (window.confirm(confirmMessage)) {
      removeItem(item.id)
    }
  }

  const avatar = item.avatarUrl ? <RoundImage url={item.avatarUrl || DEFAULT_AVATAR} medium square={square} size={size} className={classes.avatar} /> : null
  const title = item.name || item.title

  return (
    <div className='bg-card rounded-lg p-2 flex justify-between items-center'>
      <div>
        {url && <Link to={url}>{avatar}</Link>}
        {!url && avatar}

        {url && <Link to={url} className='text-foreground/100'>{title}</Link>}
        {!url && <span>{title}</span>}
      </div>

      {removeItem && <span onClick={remove} className='border-2 border-accent/20 rounded-lg p-1 text-xs text-accent/60 hover:text-accent/100 hover:bg-accent/10 hover:border-accent/40 transition-all cursor-pointer'>{t('Remove')}</span>}
    </div>
  )
}
