import React, { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SquarePen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'

/**
 * The stream's create affordance: a compact New button riding in the pinned
 * header row, per the prototype — replacing the old full-width dashed
 * "Hi {name}, click here to start a post" banner. The banner's per-type prompt
 * copy survives as the button's tooltip and accessible name.
 */
export default function PostPrompt (props) {
  const { className, firstName = '', postTypesAvailable, eventDate } = props
  const { t } = useTranslation()
  const location = useLocation()

  const type = useMemo(() => postTypesAvailable && postTypesAvailable.length === 1 ? postTypesAvailable[0] : 'default', [postTypesAvailable])
  const newPostType = postTypesAvailable?.[0]
  const createPostPath = useMemo(() => {
    const basePath = location.pathname.replace(/\/create\/.*$/, '')
    const params = new URLSearchParams()
    if (newPostType) params.set('newPostType', newPostType)
    if (eventDate) params.set('eventDate', eventDate)
    const query = params.toString()
    return `${basePath}/create/post${query ? `?${query}` : ''}`
  }, [location.pathname, newPostType, eventDate])

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
    <Link
      to={createPostPath}
      aria-label={postPromptString}
      title={postPromptString}
      data-tour='new-post'
      className={cn(
        // rounded-md, matching the group context menu's controls.
        // Icon-only on phones; the label costs width the control row lacks there
        'inline-flex items-center gap-1.5 h-9 px-4 max-sm:px-2.5 shrink-0 rounded-md box-border',
        'bg-background border-2 border-selected text-foreground text-sm font-bold',
        'transition-all hover:scale-105 hover:no-underline',
        className
      )}
    >
      <SquarePen className='w-4 h-4' />
      <span className='max-sm:hidden'>{t('New')}</span>
    </Link>
  )
}
