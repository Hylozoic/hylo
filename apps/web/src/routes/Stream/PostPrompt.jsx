import React, { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'

export default function PostPrompt (props) {
  const { className, firstName = '', postTypesAvailable } = props
  const { t } = useTranslation()
  const location = useLocation()

  const type = useMemo(() => postTypesAvailable && postTypesAvailable.length === 1 ? postTypesAvailable[0] : 'default', [postTypesAvailable])
  const newPostType = postTypesAvailable?.[0]
  const createPostPath = useMemo(() => {
    const basePath = location.pathname.replace(/\/create\/.*$/, '')
    const params = new URLSearchParams()
    if (newPostType) params.set('newPostType', newPostType)
    const query = params.toString()
    return `${basePath}/create/post${query ? `?${query}` : ''}`
  }, [location.pathname, newPostType])

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
      <Link to={createPostPath}>
        <div className={cn('border-2 mt-6 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-2 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex items-center gap-2', className)}>
          <Plus className='w-4 h-4' />
          {postPromptString}
        </div>
      </Link>
    </div>
  )
}
