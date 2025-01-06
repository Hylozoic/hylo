import { cn } from 'util/index'
import React, { useEffect, useState } from 'react'
import Div100vh from 'react-div-100vh'
import { useDispatch } from 'react-redux'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import Loading from 'components/Loading'
import PostDetail from 'routes/PostDetail'
import checkIsPostPublic from 'store/actions/checkIsPostPublic'
import PublicPageHeader from './PublicPageHeader'
import { DETAIL_COLUMN_ID } from 'util/scrolling'

import classes from './PublicLayoutRouter.module.scss'

export default function PublicPostDetail (props) {
  const dispatch = useDispatch()
  const routeParams = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const postId = routeParams?.postId

  useEffect(() => {
    (async () => {
      setLoading(true)

      const result = await dispatch(checkIsPostPublic(postId))
      const isPublicPost = result?.payload?.data?.post?.id
      if (!isPublicPost) {
        navigate('/login?returnToUrl=' + location.pathname + location.search, { replace: true })
      }

      setLoading(false)
    })()
  }, [dispatch, postId])

  if (loading) {
    return <Loading />
  }

  return (
    <Div100vh className={classes.publicContainer}>
      <PublicPageHeader />
      <div className={cn(classes.centerColumn, classes.nonMapView)} id={DETAIL_COLUMN_ID}>
        <div>
          <PostDetail {...props} />
        </div>
      </div>
    </Div100vh>
  )
}
