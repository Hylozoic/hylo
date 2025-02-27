import { isEqual } from 'lodash/fp'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from 'components/Button'
import HyloEditor from 'components/HyloEditor'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { cn } from 'util/index'

import general from '../GroupSettings.module.scss'

function WelcomePageTab ({ group, updateGroupSettings }) {
  const { t } = useTranslation()
  const [changed, setChanged] = useState(false)
  const editorRef = useRef()

  const save = async () => {
    setChanged(false)
    const newContent = editorRef.current.getHTML()
    updateGroupSettings({ welcomePage: newContent })
  }

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: `${t('Group Settings')} > ${t('Welcome Page')}`,
      icon: 'Hands',
      info: ''
    })
  }, [])

  if (!group) return <Loading />

  return (
    <div className={cn(general.groupSettings, 'h-full !pb-20')}>
      <div className='h-full w-full flex flex-col'>
        <h1>{t('Welcome Page Content')}</h1>
        <p className={general.detailText}>{t('New members will first see this page')}</p>
        <HyloEditor
          key={group.id}
          containerClassName='mt-2'
          className='h-full p-2 border-border border-2 border-dashed min-h-20 mt-1'
          placeholder={t('With an empty welcome page, new members will land directly on your group home page')}
          onUpdate={(v) => setChanged(!isEqual(v, group.welcomePage))}
          contentHTML={group.welcomePage}
          showMenu
          extendedMenu
          ref={editorRef}
        />
      </div>

      <div className={general.saveChanges}>
        <span className={cn({ [general.settingChanged]: changed })}>{changed ? t('Changes not saved') : t('Current settings up to date')}</span>
        <Button label={t('Save Changes')} color={changed ? 'green' : 'gray'} onClick={changed ? save : null} className={general.saveButton} />
      </div>
    </div>
  )
}

export default WelcomePageTab
