import React, { useEffect, useState } from 'react'
import Div100vh from 'react-div-100vh'
import { useDispatch } from 'react-redux'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { AnalyticsEvents } from '@hylo/shared'
import Loading from 'components/Loading'
import PostDetail from 'routes/PostDetail'
import checkIsPostPublic, { fetchPostTeaser } from 'store/actions/checkIsPostPublic'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import PublicPageHeader from './PublicPageHeader'
import PrivatePostTeaser from './PrivatePostTeaser'
import { DETAIL_COLUMN_ID } from 'util/scrolling'

export default function PublicPostDetail (props) {
  const dispatch = useDispatch()
  const routeParams = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  // Set when the post exists but the visitor can't see it: { group } (group may be null)
  const [teaser, setTeaser] = useState(null)
  const postId = routeParams?.postId
  const returnToUrl = location.pathname + location.search

  useEffect(() => {
    (async () => {
      setLoading(true)
      setTeaser(null)

      const result = await dispatch(checkIsPostPublic(postId))
      const isPublicPost = result?.payload?.data?.post?.id
      // An email unfollow link needs a signed-in reader even when the post is public
      const unfollowRequested = getQuerystringParam('action', location) === 'unfollow'
      const goToLogin = () => {
        dispatch(trackAnalyticsEvent(AnalyticsEvents.LOGIN_WALL_HIT, { kind: 'post' }))
        navigate('/login?returnToUrl=' + encodeURIComponent(returnToUrl), { replace: true })
      }

      if (unfollowRequested) {
        goToLogin()
      } else if (!isPublicPost) {
        let postTeaser = null
        try {
          const teaserResult = await dispatch(fetchPostTeaser(postId))
          postTeaser = teaserResult?.payload?.data?.postTeaser
        } catch (e) {
          postTeaser = null
        }
        if (postTeaser?.exists) {
          const group = postTeaser.group || null
          dispatch(trackAnalyticsEvent(AnalyticsEvents.LOGIN_WALL_HIT, {
            kind: group ? 'post_teaser_group' : 'post_teaser_private'
          }))
          setTeaser({ group })
        } else {
          goToLogin()
        }
      }

      setLoading(false)
    })()
  }, [dispatch, postId])

  if (loading) {
    return <Loading />
  }

  if (teaser) {
    return <PrivatePostTeaser group={teaser.group} returnToUrl={returnToUrl} />
  }

  return (
    <Div100vh className='bg-background'>
      <PublicPageHeader />
      <div className='bg-midground w-full h-full overflow-y-auto'>
        <div className='w-full h-full max-w-[750px] mx-auto mt-4' id={DETAIL_COLUMN_ID}>
          <PostDetail {...props} />
        </div>
      </div>
    </Div100vh>
  )
}
