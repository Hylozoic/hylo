import { cn } from 'util/index'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

import classes from './MultiSelect.module.scss'

const MultiSelect = ({ items, selected = [], hideAfter, handleSelect }) => {
  const { t } = useTranslation()
  const [showAll, setShowAll] = useState(false)

  const handleShowMore = () => {
    setShowAll(true)
  }

  const renderItems = () => {
    const itemsToRender = showAll || !hideAfter || items.length <= hideAfter
      ? items
      : items.slice(0, hideAfter)

    return itemsToRender.map((item, i) => (
      <div
        onClick={(evt) => {
          evt.stopPropagation()
          handleSelect && handleSelect(item.id)
        }}
        key={item.id}
        className={cn('flex items-center hover:cursor-pointer justify-between gap-2 p-2 rounded-md border border-foreground/20 hover:border-foreground/50 transition-all scale-100 hover:scale-102', { [classes.selected]: selected.includes(item.id) })}
      >
        <span>{item.text || item.title}</span>
        {handleSelect && (
          <input
            type='checkbox'
            checked={selected.includes(item.id)}
            readOnly
          />
        )}
      </div>
    ))
  }

  return (
    <ul className='flex flex-col gap-2 m-0 p-2'>
      {renderItems()}
      {hideAfter && items.length > hideAfter && !showAll && (
        <div className={classes.showMore} onClick={handleShowMore}>
          <span>{t('Show more')}</span>
        </div>
      )}
    </ul>
  )
}

export default MultiSelect
