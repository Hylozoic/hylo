import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Columns2, LayoutGrid } from 'lucide-react'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { cn } from 'util/index'
import SaveButton from '../SaveButton'

export default function AppearanceTab ({ group, updateGroupSettings }) {
  const { t } = useTranslation()
  const [layout, setLayout] = useState(group?.settings?.layout || 'two-column')
  const [changed, setChanged] = useState(false)

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: `${t('Group Settings')} > ${t('Appearance & Layout')}`,
      icon: '',
      info: '',
      search: false
    })
  }, [])

  const handleLayoutChange = (value) => {
    setLayout(value)
    setChanged(value !== (group?.settings?.layout || 'two-column'))
  }

  const save = () => {
    setChanged(false)
    updateGroupSettings({ settings: { layout } })
  }

  return (
    <div className='p-4'>
      <p className='mb-6 text-foreground/70'>
        {t('Customize how this group is displayed to members.')}
      </p>

      <div className='mb-8'>
        <label className='text-sm font-medium mb-3 block'>{t('Layout')}</label>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2 max-w-[500px]'>
          <button
            onClick={() => handleLayoutChange('two-column')}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border-2 border-foreground/20 hover:border-foreground/50 bg-transparent hover:bg-muted/50 px-4 py-4 transition-all',
              layout === 'two-column' && 'border-selected bg-selected/10'
            )}
          >
            <Columns2 className='h-8 w-8' />
            <span className='text-sm font-medium'>{t('Two Column')}</span>
            <span className='text-xs text-foreground/60 text-center'>{t('Sidebar menu with content pane')}</span>
          </button>
          <button
            onClick={() => handleLayoutChange('one-column')}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border-2 border-foreground/20 hover:border-foreground/50 bg-transparent hover:bg-muted/50 px-4 py-4 transition-all',
              layout === 'one-column' && 'border-selected bg-selected/10'
            )}
          >
            <LayoutGrid className='h-8 w-8' />
            <span className='text-sm font-medium'>{t('One Column')}</span>
            <span className='text-xs text-foreground/60 text-center'>{t('Full-width dashboard with cards')}</span>
          </button>
        </div>
      </div>

      <SaveButton changed={changed} save={save} />
    </div>
  )
}
