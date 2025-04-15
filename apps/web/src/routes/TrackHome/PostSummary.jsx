import { GripHorizontal } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate } from 'react-router-dom'
import useRouteParams from 'hooks/useRouteParams'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { editPostUrl } from 'util/navigation'

function PostSummary ({ post }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const routeParams = useRouteParams()
  const querystringParams = getQuerystringParam(['tab'], location)

  // Sortable setup
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: post.id,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
    }
  })

  const style = transform ? { transform: CSS.Transform.toString(transform), transition } : undefined

  return (
    <div
      className='flex flex-row gap-2 bg-card/50 rounded-lg border-2 border-card/30 shadow-xl hover:shadow-2xl hover:shadow-lg mb-4 relative hover:z-[2] hover:scale-101 duration-400 cursor-pointer'
      ref={setNodeRef}
      style={style}
    >
      <div className='flex flex-col flex-1 gap-2 pt-0 pb-2 px-4' onClick={() => navigate(editPostUrl(post.id, routeParams, querystringParams))}>
        <h1>{post.title}</h1>
        <div className='flex flex-row gap-2'>
          <span className='flex flex-row gap-2 bg-selected/50 rounded-lg px-2 py-1 items-center justify-center'>
            <span className='bg-background rounded-md px-2'>{post.numPeopleCompleted}</span>
            <span>{t('Completed')}</span>
          </span>
        </div>
      </div>
      <div className='flex flex-col justify-center gap-2 bg-foreground/10 p-2 rounded-r-lg'>
        <div className='cursor-grab'><GripHorizontal {...listeners} {...attributes} className='cursor-grab' /></div>
      </div>
    </div>
  )
}

export default PostSummary
