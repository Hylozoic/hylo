import React, { useCallback, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SquareKanban } from 'lucide-react'
import { localSpaceSlug, spaceUrl } from '@hylo/navigation'
import fetchForCurrentUser from 'store/actions/fetchForCurrentUser'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchPost from 'store/actions/fetchPost'
import { convertProjectToSpace } from 'store/actions/taskActions'
import { cn } from 'util/index'

/**
 * Shown on a legacy project post to the person who created it, where they are allowed to
 * create spaces. Turns the project into a project space: the post's text becomes the space's
 * description, its members join, and the post stays behind as a discussion.
 */
export default function ConvertProjectPill ({ postId, group, className }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [converting, setConverting] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleClick = useCallback(async (event) => {
    event.stopPropagation()
    if (converting) return
    const confirmed = window.confirm(t('convert-project-to-space-confirm'))
    if (!confirmed) return

    setConverting(true)
    setFailed(false)
    try {
      const result = await dispatch(convertProjectToSpace({ postId, groupId: group.id }))
      const space = result?.payload?.data?.convertProjectToSpace
      if (!space?.id) {
        setFailed(true)
        return
      }
      // The group's menu, the new space's views and the creator's membership of it all
      // have to be loaded before the space can be opened
      await Promise.all([
        dispatch(fetchGroupViews(group.id)),
        dispatch(fetchGroupViews(space.id)),
        dispatch(fetchForCurrentUser()),
        dispatch(fetchPost(postId))
      ])
      navigate(spaceUrl(group.slug, localSpaceSlug(group.slug, space.slug)))
    } catch (error) {
      setFailed(true)
    } finally {
      setConverting(false)
    }
  }, [converting, dispatch, group?.id, group?.slug, navigate, postId, t])

  return (
    <button
      type='button'
      data-testid='convert-project-pill'
      disabled={converting}
      onClick={handleClick}
      title={t('Turn this project into a space with its own task board')}
      className={cn(
        'inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-projects/40 bg-projects/15 text-xs font-bold text-projects whitespace-nowrap cursor-pointer hover:border-projects transition-all',
        { 'opacity-60 cursor-wait': converting, 'border-destructive text-destructive': failed },
        className
      )}
    >
      <SquareKanban className='w-3 h-3' />
      {converting
        ? t('Converting…')
        : failed
          ? t('Could not convert. Try again')
          : t('Convert to a space')}
    </button>
  )
}
