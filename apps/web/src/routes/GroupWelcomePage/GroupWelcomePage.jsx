import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import Button from 'components/ui/button'
import ClickCatcher from 'components/ClickCatcher'
import FundingRoundAboutInfo from 'components/FundingRoundAboutInfo/FundingRoundAboutInfo'
import HyloHTML from 'components/HyloHTML'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useEffectiveGroupSlug, useGroupRouteOpts } from 'contexts/SpaceGroupContext'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import useGroupViews from 'hooks/useGroupViews'
import { spaceHomeRoutePath, spaceHomeUrl } from '@hylo/navigation'

/** True when welcome HTML has visible text or embedded media. */
function welcomeHtmlHasContent (html) {
  if (!html) return false
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length > 0) return true
  return /<(img|video|iframe|audio)\b/i.test(html)
}

function GroupWelcomePage () {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { parentGroupSlug } = useGroupRouteOpts()
  const groupSlug = useEffectiveGroupSlug()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupViews = useGroupViews(group)
  const groupId = group?.id
  const groupViewsLoaded = group?.groupViews != null
  const welcomeHtml = useMemo(() => {
    const welcomeView = groupViews.find(view => view.type === 'welcome')
    return welcomeView?.pageContent || ''
  }, [groupViews])
  const hasWelcomeContent = welcomeHtmlHasContent(welcomeHtml)
  const isTrack = Boolean(group?.track?.id)

  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    if (groupId && !groupViewsLoaded) {
      dispatch(fetchGroupViews(groupId))
    }
  }, [dispatch, groupId, groupViewsLoaded])

  useEffect(() => {
    setHeaderDetails({
      title: t('Welcome'),
      icon: 'Hand',
      search: true
    })
  }, [setHeaderDetails, t])

  /** Opens the space's home view (track-actions for tracks). */
  const handleBegin = () => {
    if (parentGroupSlug && group) {
      navigate(spaceHomeUrl(parentGroupSlug, group))
      return
    }
    navigate(`/groups/${groupSlug}${spaceHomeRoutePath(group)}`)
  }

  if (!group) return <Loading />
  if (!groupViewsLoaded) return <Loading />

  return (
    <div className='p-4 global-postContent max-w-[750px] mx-auto'>
      {!hasWelcomeContent && (
        <h1 className='text-2xl font-bold mb-4'>
          {t('Welcome to {{group.name}}!', { group })}
        </h1>
      )}
      {hasWelcomeContent && (
        <ClickCatcher groupSlug={groupSlug}>
          <HyloHTML html={welcomeHtml} />
        </ClickCatcher>
      )}
      {group.fundingRound?.id && (
        <div className='mt-6'>
          <FundingRoundAboutInfo
            fundingRoundId={group.fundingRound.id}
            roleGroupId={group.parentId || group.id}
          />
        </div>
      )}
      {isTrack && (
        <div className='mt-8 flex justify-center'>
          <Button variant='secondary' size='lg' onClick={handleBegin}>
            {t('Begin')}
          </Button>
        </div>
      )}
    </div>
  )
}

export default GroupWelcomePage
