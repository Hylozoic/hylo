import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RoundImage from 'components/RoundImage'
import { cn } from 'util/index'
import { createPostUrl } from 'util/navigation'

export default function PostPrompt (props) {
  const { avatarUrl, className, firstName = '', querystringParams = {}, postTypesAvailable, routeParams = {} } = props
  const { t } = useTranslation()

  const type = useMemo(() => postTypesAvailable && postTypesAvailable.length === 1 ? postTypesAvailable[0] : 'default', [postTypesAvailable])

  const postPromptString = useMemo(() => {
    const postPrompts = {
      event: t('Hi {{firstName}}, click here to create an event', { firstName }),
      offer: t('Hi {{firstName}}, click here to create an offer', { firstName }),
      project: t('Hi {{firstName}}, click here to create a project', { firstName }),
      proposal: t('Hi {{firstName}}, click here to create a proposal', { firstName }),
      request: t('Hi {{firstName}}, click here to create a request', { firstName }),
      resource: t('Hi {{firstName}}, click here to create a resource', { firstName }),
      default: t('Hi {{firstName}}, click here to create a post', { firstName })
    }
    return postPrompts[type] || postPrompts.default
  }, [firstName, type])

  return (
    <div>
      <Link to={createPostUrl(routeParams, { ...querystringParams, newPostType: postTypesAvailable?.[0] })}>
        <div className={cn('rounded-sm h-14 flex items-center mx-auto cursor-pointer bg-white border border-foreground/10 text-muted-foreground shadow-sm hover:shadow-md transition-shadow duration-200', className)}>
          <RoundImage url={avatarUrl} small className='mr-2 ml-4' />
          {postPromptString}
        </div>
      </Link>
    </div>
  )
}
