import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import { agreementsURL, RESP_MANAGE_CONTENT } from 'store/constants'
import getPlatformAgreements from 'store/selectors/getPlatformAgreements'
import getMe from 'store/selectors/getMe'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import useRouteParams from 'hooks/useRouteParams'
import Avatar from 'components/Avatar/Avatar'
import MultiSelect from 'components/MultiSelect/MultiSelect'
import { groupUrl } from '@hylo/navigation'
import Button from 'components/ui/button'
import PostListRow from 'components/PostListRow'
import { cn } from 'util/index'
import { format } from 'date-fns'

const ModerationListItem = ({
  moderationAction,
  handleClearModerationAction,
  handleConfirmModerationAction,
  navigateToPost,
  group
}) => {
  const { t } = useTranslation()
  const currentUser = useSelector(getMe)
  const routeParams = useRouteParams()
  const canModerate = useSelector((state) => hasResponsibilityForGroup(state, { groupId: group.id, responsibility: [RESP_MANAGE_CONTENT] }))

  const {
    agreements,
    anonymous,
    createdAt,
    post,
    reporter,
    status,
    text
  } = moderationAction

  const platformAgreementsIds = moderationAction.platformAgreements.map(agreement => agreement.id)
  const allPlatformAgreements = useSelector(getPlatformAgreements)
  const platformAgreements = allPlatformAgreements.filter(agreement => platformAgreementsIds.includes(agreement.id))
  const reporterUrl = `/user/${reporter.id}`
  const groupAgreementsUrl = group ? groupUrl(group.slug) + `/group/${group.slug}` : ''
  const currentUserIsReporter = reporter.id === currentUser.id

  t('status-active')
  t('status-cleared')

  const statusClasses = {
    active: 'bg-accent/10 text-accent',
    cleared: 'bg-focus/10 text-focus'
  }

  return (
    <div className='rounded-xl p-4 flex flex-col transition-all bg-card/40 border-2 border-card/30 shadow-md hover:shadow-lg mb-4 relative hover:z-50 hover:scale-[1.02] duration-400'>
      <div className='flex items-center justify-between border-b border-foreground/10 pb-4'>
        <div className='flex items-center gap-2'>
          {anonymous && !canModerate
            ? (<span className='text-foreground/50'>{t('Anonymous')}</span>)
            : (
              <div className='flex items-center gap-2'>
                <Button variant='link' className='p-0' to={reporterUrl}>
                  <Avatar avatarUrl={reporter.avatarUrl} url={reporterUrl} medium />
                  <span className='over:text-accent/80 font-medium text-foreground'>{reporter.name}</span>
                </Button>
              </div>)}
          <div className='text-foreground/50 text-sm flex flex-row gap-1 items-center'>
            <span>{t('reported this on')}</span>
            <span>{format(new Date(createdAt), 'MMM d, yyyy')}</span>
          </div>
        </div>
        <span className={cn('px-3 py-1 rounded-full text-sm font-medium', statusClasses[status])}>
          {t('status-' + status)}
        </span>
      </div>

      <div className='py-4 space-y-6'>
        <div>
          <h3 className='text-foreground/50 text-center text-sm mb-2'>{t('Complaint')}</h3>
          <p className='text-foreground/100'>{text}</p>
        </div>

        <div>
          <h3 className='text-foreground/50 text-center text-sm mb-2'>{t('Reported content')}</h3>
          <div className='rounded-lg p-0 h-98 overflow-hidden shadow-xl border-2 border-foreground/10 border-b-0'>
            <PostListRow
              post={post}
              currentGroupId={group && group.id}
              currentUser={currentUser}
              routeParams={routeParams}
            />
          </div>
        </div>

        <div className='space-y-4'>
          {agreements.length > 0 && (
            <div className='space-y-2'>
              <h3 className='text-foreground/50 text-center text-sm mb-2'>{t('Group Agreements broken')}</h3>
              <MultiSelect items={agreements} />
              <a
                href={groupAgreementsUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-foreground/50 hover:text-foreground/80 text-sm border-2 border-foreground/10 rounded-lg p-1 px-2 w-fit mx-auto block hover:scale-105 transition-all'
              >
                {t('View group agreements')}
              </a>
            </div>
          )}
          {platformAgreements.length > 0 && (
            <div className='space-y-2 pt-4 border-t border-foreground/10'>
              <h3 className='text-foreground/50 text-center text-sm mb-2'>{t('Platform Agreements broken')}</h3>
              <MultiSelect items={platformAgreements} />
              <a
                href={agreementsURL}
                target='_blank'
                rel='noopener noreferrer'
                className='text-foreground/50 hover:text-foreground/80 text-sm border-2 border-foreground/10 rounded-lg p-1 px-2 w-fit mx-auto block hover:scale-105 transition-all'
              >
                {t('View platform agreements')}
              </a>
            </div>
          )}
        </div>
      </div>

      {(canModerate || currentUserIsReporter) && status !== 'cleared' && (
        <div className='pt-4 border-t border-foreground/10'>
          <Button
            onClick={handleClearModerationAction}
            variant='outline'
          >
            {t('Clear')} <span className='text-xs text-foreground/50'>{t('This will remove the report from the moderation queue, and remove the flag from the post.')}</span>
          </Button>
        </div>
      )}
    </div>
  )
}

export default ModerationListItem
