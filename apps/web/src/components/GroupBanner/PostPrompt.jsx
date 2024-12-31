import { cn } from 'util'
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RoundImage from 'components/RoundImage'
import { createPostUrl } from 'util/navigation'

import classes from './GroupBanner.module.scss'

export default function PostPrompt (props) {
  const { avatarUrl, className, firstName = '', type = '', querystringParams = {}, routeParams = {} } = props
  const [hover, setHover] = useState(false)
  const { t } = useTranslation()

  const postPromptString = (type, firstName) => {
    const postPrompts = {
      offer: t('Hi {{firstName}}, what would you like to share?', { firstName }),
      request: t('Hi {{firstName}}, what are you looking for?', { firstName }),
      project: t('Hi {{firstName}}, what would you like to create?', { firstName }),
      event: t('Hi {{firstName}}, want to create an event?', { firstName }),
      default: t('Hi {{firstName}}, click here to start a post', { firstName })
    }
    return postPrompts[type] || postPrompts.default
  }

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Link to={createPostUrl(routeParams, { ...querystringParams, newPostType: type })}>
        <div className={cn(classes.postPrompt, className)}>
          <RoundImage url={avatarUrl} small className={classes.promptImage} />
          {postPromptString(type, firstName)}
        </div>
      </Link>
      <div className={cn(classes.shadow, { [classes.hover]: hover })} />
    </div>
  )
}
