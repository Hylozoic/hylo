import { isEqual } from 'lodash/fp'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import HyloEditor from 'components/HyloEditor'
import Loading from 'components/Loading'
import SwitchStyled from 'components/SwitchStyled'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { cn } from 'util/index'
import SaveButton from '../SaveButton'
import general from '../GroupSettings.module.scss'

function WelcomePageTab ({ group, updateGroupSettings }) {
  const { t } = useTranslation()
  const { setHeaderDetails } = useViewHeader()
  const [showWelcomePage, setShowWelcomePage] = useState(group?.settings.showWelcomePage ?? false)
  const [changed, setChanged] = useState(false)
  const editorRef = useRef()

  useEffect(() => {
    setHeaderDetails({
      title: `${t('Group Settings')} > ${t('Welcome Page')}`,
      icon: 'Hands',
      info: ''
    })
  }, [])

  if (!group) return <Loading />

  const save = async () => {
    setChanged(false)
    const newContent = editorRef.current.getHTML()
    updateGroupSettings({ welcomePage: newContent, settings: { showWelcomePage } })
  }

  const toggleShowWelcomePage = () => {
    setChanged(showWelcomePage === group.settings.showWelcomePage || !isEqual(editorRef.current.getHTML(), group.welcomePage)) // TODO: or content has changed
    setShowWelcomePage(!showWelcomePage)
  }

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
          className='h-full p-2 border-border border-2 border-dashed min-h-20 mt-1 rounded-lg bg-input'
          extendedMenu
          groupIds={[group.id]}
          onUpdate={(html) => {
            setChanged(!isEqual(html, group.welcomePage))
          }}
          placeholder={t('Your welcome page content here')}
          ref={editorRef}
          showMenu
          type='welcomePage'
        />
      </div>

      <SaveButton save={save} changed={changed} />
    </div>
  )
}

export default WelcomePageTab
