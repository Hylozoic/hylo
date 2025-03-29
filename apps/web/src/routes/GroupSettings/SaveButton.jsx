import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'

import general from './GroupSettings.module.scss'

export default function SaveButton ({ changed, error, save }) {
  const { t } = useTranslation()

  const style = useMemo(() => {
    return !changed ? '' : error ? general.settingIncorrect : general.settingChanged
  }, [changed, error])

  const text = useMemo(() => {
    return !changed ? t('Current settings up to date') : error || t('Changes not saved')
  }, [changed, error])

  return (
    <div className={cn(
      'sticky bottom-4 left-[50%] translate-x-[-50%] w-[60%] bg-background rounded-xl p-4 flex justify-between items-center translate-y-[200px] transition-all opacity-0 scale-0',
      {
        'border-2 border-accent border-dashed text-accent translate-y-[0px] opacity-100 scale-100': changed
      })}
    >
      <span className={style}>{text}</span>
      <button onClick={changed && !error ? save : null} className='bg-foreground rounded text-background py-1 px-2 text-bold'>
        {t('Save Changes')}
      </button>
    </div>
  )
}
