import React, { useEffect, useState } from 'react'
import Div100vh from 'react-div-100vh'
import { useDispatch } from 'react-redux'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import Loading from 'components/Loading'
import MemberProfile from 'routes/MemberProfile'
import checkIsPersonPublic from 'store/actions/checkIsPersonPublic'
import PublicPageHeader from './PublicPageHeader'
import { CENTER_COLUMN_ID } from 'util/scrolling'

/**
 * Public member profile page for non-authenticated users.
 * Allows access only when the person has opted into a public profile.
 */
export default function PublicMemberProfile (props) {
  const dispatch = useDispatch()
  const routeParams = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const personId = routeParams?.personId

  useEffect(() => {
    (async () => {
      setLoading(true)

      const result = await dispatch(checkIsPersonPublic(personId))
      const isPublicProfile = result?.payload?.data?.person?.id
      if (!isPublicProfile) {
        navigate('/login?returnToUrl=' + location.pathname + location.search, { replace: true })
      }

      setLoading(false)
    })()
  }, [dispatch, personId, location.pathname, location.search, navigate])

  if (loading) {
    return <Loading />
  }

  return (
    <Div100vh className='flex flex-col items-stretch bg-background'>
      <PublicPageHeader />
      <div className='w-full h-full overflow-y-auto'>
        <div className='bg-midground w-full max-w-[750px] mx-auto rounded-xl' id={CENTER_COLUMN_ID}>
          <MemberProfile {...props} context='public' />
        </div>
      </div>
    </Div100vh>
  )
}
