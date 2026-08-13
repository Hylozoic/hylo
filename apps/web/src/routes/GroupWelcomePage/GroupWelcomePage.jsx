import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import ClickCatcher from 'components/ClickCatcher'
import FundingRoundAboutInfo from 'components/FundingRoundAboutInfo/FundingRoundAboutInfo'
import HyloHTML from 'components/HyloHTML'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViews } from 'store/selectors/getGroupViews'

function GroupWelcomePage () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const groupSlug = useEffectiveGroupSlug()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupViews = useSelector(state => group ? getGroupViews(state, group) : [])
  const groupId = group?.id
  const groupViewsLoaded = group?.groupViews != null
  const welcomeHtml = useMemo(() => {
    const welcomeView = groupViews.find(view => view.type === 'welcome')
    return welcomeView?.pageContent || ''
  }, [groupViews])

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

  if (!group) return <Loading />
  if (!groupViewsLoaded) return <Loading />

  return (
    <div className='p-4 global-postContent max-w-[750px] mx-auto'>
      <ClickCatcher groupSlug={groupSlug}>
        <HyloHTML html={welcomeHtml} />
      </ClickCatcher>
      {group.fundingRound?.id && (
        <div className='mt-6'>
          <FundingRoundAboutInfo
            fundingRoundId={group.fundingRound.id}
            roleGroupId={group.parentId || group.id}
          />
        </div>
      )}
    </div>
  )
}

export default GroupWelcomePage
