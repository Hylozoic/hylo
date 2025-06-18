import React from 'react'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { ALL_VIEW, FARM_VIEW } from 'util/constants'

export default function GroupViewFilter ({ viewFilter, changeView }) {
  const { t } = useTranslation()
  return (
    <div className='inline-flex justify-start gap-2 bg-input/30 rounded-md p-1'>
      <Button variant={viewFilter === ALL_VIEW ? 'selectedOutline' : 'primary'} className='p-1 px-2 text-sm' onClick={() => changeView(ALL_VIEW)}>{t('All Groups')}</Button>
      <Button variant={viewFilter === FARM_VIEW ? 'selectedOutline' : 'primary'} className='p-1 px-2 text-sm' onClick={() => changeView(FARM_VIEW)}>{t('Farms')}</Button>
    </div>
  )
}
