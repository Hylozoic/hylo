import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Loading from 'components/Loading'
import PostCard from 'components/PostCard'
import isPendingFor from 'store/selectors/isPendingFor'
import { FETCH_MEMBER_POSTS } from '../MemberProfile.store'
import {
  getMemberPosts,
  fetchMemberPosts
} from './MemberPosts.store'
import classes from './MemberPosts.module.scss'

export default function MemberPosts ({ routeParams = {}, loading: loadingProp }) {
  const dispatch = useDispatch()
  const posts = useSelector(state => getMemberPosts(state, { routeParams }))
  const loadingFromStore = useSelector(state => isPendingFor(FETCH_MEMBER_POSTS, state))
  const loading = loadingProp ?? loadingFromStore

  useEffect(() => {
    dispatch(fetchMemberPosts(routeParams.personId))
  }, [dispatch, routeParams.personId])

  const itemSelected = selectedItemId => selectedItemId === routeParams.postId

  if (loading) return <Loading />

  return (
    <div>
      {posts && posts.map(post =>
        <div className={classes.activityItem} key={post.id}>
          <PostCard post={post} expanded={itemSelected(post.id)} />
        </div>
      )}
    </div>
  )
}
