import PropTypes from 'prop-types'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import SwitchStyled from 'components/SwitchStyled'
import classes from './PublicToggle.module.scss'

const PublicToggle = ({ isPublic = false, togglePublic, selectedGroups = [] }) => {
  const { t } = useTranslation()
  const allowedInTheCommons = selectedGroups.some(group => group.allowInPublic)
  return (
    <div className='flex flex-col gap-2'>
      <div className={cn('w-full text-foreground/50 hover:text-foreground/100 text-xs cursor-pointer rounded', { [classes.postIsPublic]: isPublic })} onClick={togglePublic} role='button'>
        <div className='w-full flex gap-2'>
          <SwitchStyled checked={isPublic} onChange={togglePublic} backgroundColor={isPublic ? 'hsl(var(--selected))' : 'hsl(var(--foreground))'} />
          <div>
            <span>{isPublic ? t('Post will be publicly visible and shareable') : t('Make Public - Currently, only groups you specify above will see this post')}</span>
          </div>
        </div>
      </div>
      {allowedInTheCommons && (
        <div className='text-foreground/50 text-xs h-4 bg-background rounded-full px-2'>
          {t('visibleInCommonsText')}
        </div>
      )}
    </div>
  )
}

PublicToggle.propTypes = {
  isPublic: PropTypes.bool,
  togglePublic: PropTypes.func
}

export default PublicToggle
