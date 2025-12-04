import { GripHorizontal, EllipsisVertical } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import ActionCompletionResponsesDialog from 'components/ActionCompletionResponsesDialog'
import useRouteParams from 'hooks/useRouteParams'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import deletePost from 'store/actions/deletePost'
import { editPostUrl, trackUrl } from '@hylo/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'

function ActionSummary ({ post }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const routeParams = useRouteParams()
  const querystringParams = getQuerystringParam(['tab'], location)
  const dispatch = useDispatch()
  const [showCompletionResponsesDialog, setShowCompletionResponsesDialog] = useState(false)
  // Sortable setup
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: post.id,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
    }
  })

  const style = transform ? { transform: CSS.Transform.toString(transform), transition } : undefined

  const deletePostWithConfirm = (postId) => {
    if (window.confirm(t('Are you sure you want to remove this action? You cannot undo this.'))) {
      dispatch(deletePost(postId, null, routeParams.trackId))
    }
  }

  const handleShowCompletionResponsesDialog = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setShowCompletionResponsesDialog(true)
  }

  return (
    <div
      className='ActionSummary flex flex-row gap-2 bg-card/50 rounded-lg border-2 border-card/30 shadow-xl hover:shadow-2xl hover:shadow-lg mb-4 relative hover:z-[2] hover:scale-101 duration-400 cursor-pointer'
      ref={setNodeRef}
      style={style}
    >
      <div className='flex flex-col flex-1 gap-2 pt-0 pb-2 px-4' onClick={() => navigate(editPostUrl(post.id, routeParams, querystringParams))}>
        <h1>{post.title}</h1>
        <div className='flex flex-row gap-2'>
          <span className='flex flex-row gap-2 bg-selected/50 rounded-lg px-2 py-1 items-center justify-center hover:bg-selected/80 transition-all duration-200 cursor-pointer' onClick={handleShowCompletionResponsesDialog}>
            <span className='bg-background rounded-md px-2'>{post.numPeopleCompleted || 0}</span>
            <span>{t('Completed')}</span>
          </span>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className='outline-none'><EllipsisVertical /></DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={-30} align='end'>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}${trackUrl(routeParams.trackId, { groupSlug: routeParams.groupSlug })}/post/${post.id}`)}>
            {t('Copy Link')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => deletePostWithConfirm(post.id)}>{t('Remove')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className='flex flex-col justify-center gap-2 bg-foreground/10 p-2 rounded-r-lg'>
        <div className='cursor-grab'><GripHorizontal {...listeners} {...attributes} className='cursor-grab' /></div>
      </div>
      {showCompletionResponsesDialog && (
        <ActionCompletionResponsesDialog
          post={post}
          onClose={() => setShowCompletionResponsesDialog(false)}
        />
      )}
    </div>
  )
}

export default ActionSummary
