import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useParams } from 'react-router-dom'
import Loading from 'components/Loading'
import PostCard from 'components/PostCard'
import { getMemberReactions, fetchMemberReactions } from './MemberReactions.store'

import classes from './MemberReactions.module.scss'

const MemberReactions = () => {
  const dispatch = useDispatch()
  const routeParams = useParams()
  const posts = useSelector(state => getMemberReactions(state, { routeParams }))
  const loading = useSelector(state => state.loading) // Assuming there's a loading state in the store

  useEffect(() => {
    dispatch(fetchMemberReactions(routeParams.personId))
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

export default MemberReactions
