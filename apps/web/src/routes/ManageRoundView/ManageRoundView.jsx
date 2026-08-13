import { Settings } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import Loading from 'components/Loading'
import { useEffectiveGroupSlug, useGroupRouteOpts } from 'contexts/SpaceGroupContext'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import SpaceSettingsModal from 'routes/AuthLayoutRouter/components/ContextMenu/SpaceSettingsModal'
import FundingRoundPhaseManager from 'routes/FundingRoundSubmissionsView/FundingRoundPhaseManager'
import { FETCH_FUNDING_ROUND, fetchFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import { RESP_ADMINISTRATION } from 'store/constants'
import getFundingRound from 'store/selectors/getFundingRound'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import isPendingFor from 'store/selectors/isPendingFor'
import { spaceHomeUrl } from '@hylo/navigation'

/** Steward-only view for funding-round phase management and settings. */
export default function ManageRoundView () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const groupSlug = useEffectiveGroupSlug()
  const { parentGroupSlug } = useGroupRouteOpts()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const parentGroup = useSelector(state => parentGroupSlug ? getGroupForSlug(state, parentGroupSlug) : null)
  const round = useSelector(state => {
    const nested = group?.fundingRound
    if (!nested?.id) return null
    return getFundingRound(state, nested.id) || nested
  })
  const roundId = round?.id || group?.fundingRound?.id
  const roleGroupId = group?.parentId || parentGroup?.id || group?.id
  const canManageRound = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADMINISTRATION,
    groupId: roleGroupId
  }))
  const isLoadingRound = useSelector(state => isPendingFor(FETCH_FUNDING_ROUND, state))
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (roundId) dispatch(fetchFundingRound(roundId))
  }, [roundId, dispatch])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Manage Round'),
      search: false,
      icon: <Settings />
    })
  }, [t, setHeaderDetails])

  if (!roleGroupId || !roundId || (isLoadingRound && !round?.phase)) return <Loading />
  if (!canManageRound) {
    if (!parentGroupSlug || !group) return null
    return <Navigate to={spaceHomeUrl(parentGroupSlug, group)} replace />
  }
  if (!round) return null

  return (
    <>
      <div className='flex flex-col flex-1 w-full mx-auto p-1 sm:p-4 max-w-[750px]'>
        <FundingRoundPhaseManager
          round={round}
          spaceName={group?.name}
          submissionCount={round.numSubmissions}
          participantCount={group?.memberCount}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>
      {settingsOpen && group && parentGroup && (
        <SpaceSettingsModal
          space={{
            ...(group.ref || group),
            acceptedPostTypes: group.acceptedPostTypes,
            groupRoles: group.groupRoles,
            locationObject: group.locationObject,
            requiredRoles: group.requiredRoles,
            fundingRound: round,
            track: group.track
          }}
          group={parentGroup}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  )
}
