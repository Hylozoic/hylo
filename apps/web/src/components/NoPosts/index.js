import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { cn } from 'util/index'
import { CircleDashed, MessageSquareDashed } from 'lucide-react'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import useIntroducePrompt from 'hooks/useIntroducePrompt'
import useRouteParams from 'hooks/useRouteParams'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'

const actionClasses = 'mt-3 border-2 border-foreground/20 rounded-lg px-4 py-2 text-foreground/70 font-medium transition-colors hover:text-foreground hover:border-foreground/40'

// A group's own stream: its home, All posts or Discussions, with no search,
// topic, type or active-only filter narrowing it
const GROUP_STREAM_VIEWS = ['', 'stream', 'discussions']

/**
 * True when the stream shows everything in the group. Follows the stream's
 * own filters: the URL's, then the ones the person saved (a saved post type
 * or "only active"). Discussions shows discussions whatever type is saved.
 */
function useIsUnfilteredGroupStream () {
  const routeParams = useRouteParams()
  const savedFilters = useSelector(state => getMe(state)?.settings)
  const view = routeParams.view || ''
  if (routeParams.context !== 'groups' || !GROUP_STREAM_VIEWS.includes(view)) return false
  if (routeParams.search || routeParams.topicName) return false
  const postType = routeParams.t || savedFilters?.streamPostType
  if (view !== 'discussions' && postType && postType !== 'all') return false
  const activeOnly = routeParams.activeOnly ? routeParams.activeOnly === 'true' : !!savedFilters?.activePostsOnly
  return !activeOnly
}

/**
 * "Introduce yourself" for a group whose stream is empty: shown to members
 * next to the stream's own create button (so never for load errors or the
 * no-groups state), and only where the group takes discussions. The stream
 * can say so itself with offerIntroduction; otherwise it is worked out here.
 */
function useEmptyGroupIntroduction ({ actionLabel, onAction, offerIntroduction }) {
  const { t } = useTranslation()
  const groupSlug = useEffectiveGroupSlug()
  const group = useSelector(state => groupSlug ? getGroupForSlug(state, groupSlug) : null)
  const { canIntroduce, openIntroduction } = useIntroducePrompt(group, { entry: 'empty_state' })
  const isUnfilteredGroupStream = useIsUnfilteredGroupStream()
  const offersCreate = !!onAction && actionLabel === t('Create something')
  const offered = typeof offerIntroduction === 'boolean'
    ? offerIntroduction
    : isUnfilteredGroupStream && offersCreate
  return canIntroduce && offered ? openIntroduction : null
}

const NoPosts = ({ message, className, icon, actionLabel, onAction, secondaryActionLabel, onSecondaryAction, offerIntroduction }) => {
  const { t } = useTranslation()
  const introduceYourself = useEmptyGroupIntroduction({ actionLabel, onAction, offerIntroduction })
  const tMessage = message || t('Nothing to see here')
  return (
    // col-span-full so this centres across the whole stream: the grid view modes
    // make the container a CSS grid, where an unspanned child sits in column one.
    // It is inert in the list and card views.
    <div className={cn('text-center flex flex-col items-center justify-center w-full col-span-full', className)}>
      {icon === 'message-dashed'
        ? <MessageSquareDashed className='w-12 h-12 opacity-50' />
        : <CircleDashed className='w-12 h-12 opacity-50' />}
      <div><h2 className='opacity-70'>{tMessage}</h2></div>
      <div className='flex flex-wrap justify-center gap-x-2'>
        {introduceYourself && (
          <button type='button' onClick={introduceYourself} className={actionClasses} data-testid='no-posts-introduce'>
            {t('Introduce yourself')}
          </button>
        )}
        {actionLabel && onAction && (
          <button type='button' onClick={onAction} className={actionClasses}>
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button type='button' onClick={onSecondaryAction} className={actionClasses}>
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

export default NoPosts
