import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RoundImage from 'components/RoundImage'
import { cn } from 'util/index'
import { createPostUrl } from 'util/navigation'

export default function PostPrompt (props) {
  const { avatarUrl, className, firstName = '', type = '', querystringParams = {}, routeParams = {} } = props
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
    <div>
      <Link to={createPostUrl(routeParams, { ...querystringParams, newPostType: type })}>
        <div className={cn('rounded-sm h-14 flex items-center mx-auto cursor-pointer bg-white border border-foreground/10 text-muted-foreground shadow-sm hover:shadow-md transition-shadow duration-200', className)}>
          <RoundImage url={avatarUrl} small className='mr-2 ml-4' />
          {postPromptString(type, firstName)}
        </div>
      </Link>
    </div>
  )
}
