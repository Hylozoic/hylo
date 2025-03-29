import React from 'react'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { ALL_VIEW, FARM_VIEW } from 'util/constants'

export default function GroupViewFilter ({ viewFilter, changeView }) {
  const { t } = useTranslation()
  return (
    <div className='w-full flex justify-center gap-2 pt-2'>
      <Button variant={viewFilter === ALL_VIEW ? 'secondary' : 'primary'} onClick={() => changeView(ALL_VIEW)}>{t('All')}</Button>
      <Button variant={viewFilter === FARM_VIEW ? 'secondary' : 'primary'} onClick={() => changeView(FARM_VIEW)}>{t('Farms')}</Button>
    </div>
  )
}
