import { isEqual } from 'lodash/fp'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from 'components/Button'
import HyloEditor from 'components/HyloEditor'
import Loading from 'components/Loading'
import SwitchStyled from 'components/SwitchStyled'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { cn } from 'util/index'
import general from '../GroupSettings.module.scss'

function WelcomePageTab ({ group, updateGroupSettings }) {
  const { t } = useTranslation()
  const [showWelcomePage, setShowWelcomePage] = useState(group.settings.showWelcomePage)
  const [changed, setChanged] = useState(false)
  const editorRef = useRef()

  const save = async () => {
    setChanged(false)
    const newContent = editorRef.current.getHTML()
    updateGroupSettings({ welcomePage: newContent, settings: { showWelcomePage } })
  }

  const toggleShowWelcomePage = () => {
    setChanged(changed || showWelcomePage === group.settings.showWelcomePage) // TODO: or content has changed
    setShowWelcomePage(!showWelcomePage)
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
        <h1>{t('Welcome Page')}</h1>
        <div>
          <SwitchStyled
            checked={showWelcomePage}
            onChange={toggleShowWelcomePage}
            backgroundColor={showWelcomePage ? 'hsl(var(--selected))' : 'rgba(0 0 0 / .6)'}
          />
          <span className='text-foreground text-sm pl-2'>{t('Show this welcome page to new members when they first land in the group. If this is turned off then they will go directly to your home view.')}</span>
        </div>

        <HyloEditor
          key={group.id}
          containerClassName='mt-2'
          contentHTML={group.welcomePage}
          className='h-full p-2 border-border border-2 border-dashed min-h-20 mt-1'
          extendedMenu
          groupIds={[group.id]}
          onUpdate={(v) => setChanged(!isEqual(v, group.welcomePage))}
          placeholder={t('Your welcome page content here')}
          ref={editorRef}
          showMenu
          type='welcomePage'
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
