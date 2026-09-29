import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { push, replace } from 'redux-first-history'
import { AnalyticsEvents } from '@hylo/shared'
import { groupUrl } from '@hylo/navigation'
import Loading from 'components/Loading'
import RoundImage from 'components/RoundImage'
import { joinGroup } from 'routes/GroupDetail/GroupDetail.store'
import getMe from 'store/selectors/getMe'
import { DEFAULT_AVATAR } from 'store/models/Group'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import WelcomeWizardModalFooter from '../WelcomeWizardModalFooter'

export const FETCH_RECOMMENDED_GROUPS = 'RecommendedGroups/FETCH_RECOMMENDED_GROUPS'
export const RECOMMENDED_GROUP_COUNT = 4
export const NEXT_STEP_PATH = '/welcome/explore'
const STEP = 'recommended-groups'

export function fetchRecommendedGroups (first = RECOMMENDED_GROUP_COUNT) {
  return {
    type: FETCH_RECOMMENDED_GROUPS,
    graphql: {
      query: `query RecommendedGroups ($first: Int) {
        recommendedGroups(first: $first) {
          id
          name
          slug
          avatarUrl
          description
          location
          memberCount
          settings {
            askJoinQuestions
          }
          agreements {
            items {
              id
            }
          }
          joinQuestions {
            items {
              id
            }
          }
        }
      }`,
      variables: { first }
    }
  }
}

/**
 * Groups with agreements or join questions are joined from their About page,
 * where those are shown; the rest can be joined with one tap.
 */
export function needsAboutPage (group) {
  const agreementCount = group?.agreements?.items?.length || 0
  const questionCount = group?.settings?.askJoinQuestions ? (group?.joinQuestions?.items?.length || 0) : 0
  return agreementCount > 0 || questionCount > 0
}

/**
 * Welcome wizard step for people who signed up without an invitation:
 * a few live, open groups near them, with one-tap join. Skipped when there are none.
 */
export default function RecommendedGroups () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const [groups, setGroups] = useState(null)
  const [joiningId, setJoiningId] = useState(null)
  const [joinedIds, setJoinedIds] = useState([])
  const [error, setError] = useState(null)
  const hasLocation = !!currentUser?.locationObject

  useEffect(() => {
    let cancelled = false
    dispatch(fetchRecommendedGroups())
      .then(result => {
        if (cancelled) return
        const items = result?.payload?.data?.recommendedGroups || []
        if (items.length === 0) {
          dispatch(replace(NEXT_STEP_PATH))
          return
        }
        setGroups(items)
        dispatch(trackAnalyticsEvent(AnalyticsEvents.WELCOME_WIZARD_STEP_VIEWED, { step: STEP, groupCount: items.length, hasLocation }))
      })
      .catch(() => {
        if (!cancelled) dispatch(replace(NEXT_STEP_PATH))
      })
    return () => { cancelled = true }
  }, [])

  const join = useCallback(async (group, position) => {
    setJoiningId(group.id)
    setError(null)
    try {
      const result = await dispatch(joinGroup(group.id, [], undefined, undefined, false))
      if (result?.error || !result?.payload?.data?.joinGroup) {
        setError(t('Something went wrong. Please try again.'))
        return
      }
      setJoinedIds(ids => ids.concat(group.id))
      dispatch(trackAnalyticsEvent(AnalyticsEvents.RECOMMENDED_GROUP_JOINED, { groupId: group.id, position, hasLocation }))
    } catch (e) {
      setError(t('Something went wrong. Please try again.'))
    } finally {
      setJoiningId(null)
    }
  }, [dispatch, hasLocation, t])

  const next = () => {
    if (joinedIds.length === 0) {
      dispatch(trackAnalyticsEvent(AnalyticsEvents.WELCOME_WIZARD_STEP_SKIPPED, { step: STEP }))
    }
    dispatch(push(NEXT_STEP_PATH))
  }

  if (!groups) {
    return (
      <div className='bg-card shadow-md w-[360px] mx-auto rounded-lg min-h-[480px] flex items-center justify-center'>
        <Loading />
      </div>
    )
  }

  return (
    <div className='bg-card shadow-md w-[360px] mx-auto rounded-lg' data-testid='recommended-groups'>
      <div className='p-4 sm:p-8 flex flex-col min-h-[480px]'>
        <div className='text-center mb-4'>
          <h3 className='text-2xl font-bold text-foreground mb-2'>{t('Groups you can join')}</h3>
          <p className='text-muted-foreground text-sm'>
            {hasLocation
              ? t('Active groups open to everyone, starting with those near you.')
              : t('Active groups open to everyone.')}
          </p>
        </div>
        {error && <p className='text-sm text-destructive text-center mb-2' role='alert'>{error}</p>}
        <ul className='flex flex-col gap-3 m-0 p-0 list-none'>
          {groups.map((group, index) => {
            const joined = joinedIds.includes(group.id)
            return (
              <li key={group.id} className='flex items-center gap-3 bg-background rounded-lg p-3 shadow-sm' data-testid='recommended-group'>
                <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} size='44px' square />
                <div className='min-w-0 flex-1'>
                  <div className='font-bold text-foreground truncate'>{group.name}</div>
                  <div className='text-xs text-muted-foreground truncate'>
                    {t('{{count}} members', { count: group.memberCount || 0 })}
                    {group.location ? ` · ${group.location}` : ''}
                  </div>
                  {group.description && <div className='text-xs text-foreground/70 line-clamp-2'>{group.description}</div>}
                </div>
                <GroupAction
                  group={group}
                  joined={joined}
                  joining={joiningId === group.id}
                  onJoin={() => join(group, index + 1)}
                />
              </li>
            )
          })}
        </ul>
        <div className='mt-auto'>
          <WelcomeWizardModalFooter
            showPrevious={false}
            submit={next}
            continueReady={joinedIds.length > 0}
            continueText={joinedIds.length > 0 ? t('Continue') : t('Skip for now')}
          />
        </div>
      </div>
    </div>
  )
}

function GroupAction ({ group, joined, joining, onJoin }) {
  const { t } = useTranslation()
  if (joined) {
    return (
      <Link to={groupUrl(group.slug)} className='shrink-0 text-sm font-bold text-foreground underline'>
        {t('Open')}
      </Link>
    )
  }
  if (needsAboutPage(group)) {
    return (
      <Link
        to={groupUrl(group.slug, 'about')}
        className='shrink-0 rounded-lg border-2 border-foreground/20 hover:border-foreground/50 px-3 py-1 text-sm text-foreground'
      >
        {t('View')}
      </Link>
    )
  }
  return (
    <button
      type='button'
      className='shrink-0 rounded-lg border-2 border-selected bg-selected px-3 py-1 text-sm text-foreground disabled:opacity-50'
      disabled={joining}
      onClick={onJoin}
    >
      {t('Join')}
    </button>
  )
}
