import { cn } from 'util/index'
import React, { useEffect, useState } from 'react'
import Div100vh from 'react-div-100vh'
import { useDispatch } from 'react-redux'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import checkIsPublicGroup from 'store/actions/checkIsPublicGroup'
import Loading from 'components/Loading'
import GroupDetail from 'routes/GroupDetail'
import PublicPageHeader from './PublicPageHeader'
import { CENTER_COLUMN_ID } from 'util/scrolling'

import classes from './PublicLayoutRouter.module.scss'

export default function PublicGroupDetail (props) {
  const dispatch = useDispatch()
  const routeParams = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const groupSlug = routeParams?.groupSlug

  useEffect(() => {
    (async () => {
      setLoading(true)
      const result = await dispatch(checkIsPublicGroup(groupSlug))
      const isPublicGroup = result?.payload?.data?.group?.visibility === 2
      if (!isPublicGroup) {
        navigate('/login?returnToUrl=' + location.pathname + location.search, { replace: true })
      }

      setLoading(false)
    })()
  }, [groupSlug, location.pathname, location.search])

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
