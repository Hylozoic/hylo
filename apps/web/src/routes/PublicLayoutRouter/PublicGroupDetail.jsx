import React, { useEffect, useState } from 'react'
import Div100vh from 'react-div-100vh'
import { useDispatch } from 'react-redux'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import checkIsGroupViewable from 'store/actions/checkIsGroupViewable'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import Loading from 'components/Loading'
import GroupDetail from 'routes/GroupDetail'
import PublicPageHeader from './PublicPageHeader'
import { CENTER_COLUMN_ID } from 'util/scrolling'

/**
 * Public group detail page - shows group about page for non-authenticated users
 * Allows access to restricted/hidden groups when valid invitation params are present
 */
export default function PublicGroupDetail (props) {
  const dispatch = useDispatch()
  const routeParams = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const groupSlug = routeParams?.groupSlug

  // Read invitation params from URL (passed by JoinGroup redirect)
  const accessCode = getQuerystringParam('accessCode', location)
  const invitationToken = getQuerystringParam('token', location)
  const hasInvitationParams = !!(accessCode || invitationToken)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const loginPath = '/login?returnToUrl=' + encodeURIComponent(location.pathname + location.search)
      try {
        const result = await dispatch(checkIsGroupViewable(groupSlug, { accessCode, invitationToken }))
        if (cancelled) return
        const groupData = result?.payload?.data?.group ?? result?.payload?.getData?.()
        const isPublicGroup = groupData?.visibility === 2
        if (!isPublicGroup && !(hasInvitationParams && groupData)) {
          navigate(loginPath, { replace: true })
          return
        }
        setLoading(false)
      } catch {
        if (!cancelled) navigate(loginPath, { replace: true })
      }
    })()
    return () => { cancelled = true }
  }, [groupSlug, location.pathname, location.search, accessCode, invitationToken, hasInvitationParams, dispatch, navigate])

  if (loading) {
    return <Loading />
  }

  return (
    <Div100vh className='flex flex-col items-stretch bg-background'>
      <PublicPageHeader />
      <div className='w-full h-full overflow-y-auto'>
        <div className='bg-midground w-full max-w-[750px] mx-auto rounded-xl' id={CENTER_COLUMN_ID}>
          <GroupDetail {...props} context='public' />
        </div>
      </div>
    </Div100vh>
  )
}
