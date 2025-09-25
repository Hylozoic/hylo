import React, { useEffect, useState } from 'react'
import Div100vh from 'react-div-100vh'
import { useDispatch } from 'react-redux'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import Loading from 'components/Loading'
import PostDetail from 'routes/PostDetail'
import checkIsPostPublic from 'store/actions/checkIsPostPublic'
import PublicPageHeader from './PublicPageHeader'
import { DETAIL_COLUMN_ID } from 'util/scrolling'

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
