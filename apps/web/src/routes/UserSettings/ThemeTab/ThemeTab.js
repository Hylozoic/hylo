import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import ThemeSelector from 'components/ThemeSelector/ThemeSelector'

export default function ThemeTab () {
  const { t } = useTranslation()

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Appearance Settings'),
      icon: '',
      info: '',
      search: false
    })
  }, [])

  return (
    <div className='p-4'>
      <p className='mb-6 text-foreground/70'>
        {t('Customize the look and feel of Hylo by choosing your preferred display mode and color scheme.')}
      </p>
      <ThemeSelector />
    </div>
  )
}
