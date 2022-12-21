import cx from 'classnames'
import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useParams, useLocation, useHistory, Redirect, Route, Switch } from 'react-router-dom'
import Div100vh from 'react-div-100vh'
import { POST_DETAIL_MATCH, GROUP_DETAIL_MATCH } from 'util/navigation'
import { CENTER_COLUMN_ID, DETAIL_COLUMN_ID } from 'util/scrolling'
import HyloCookieConsent from 'components/HyloCookieConsent'
import GroupDetail from 'routes/GroupDetail'
import GroupExplorer from 'routes/GroupExplorer'
import Loading from 'components/Loading'
import MapExplorer from 'routes/MapExplorer'
import PostDetail from 'routes/PostDetail'
import './PublicLayoutRouter.scss'
import gql from 'graphql-tag'

export default function PublicLayoutRouter (props) {
  const routeParams = useParams()
  const location = useLocation()
  const isMapView = routeParams?.view === 'map'

  return (
    <Div100vh styleName={cx('public-container', { 'map-view': isMapView })}>
      <PublicPageHeader />
      <Switch>
        <Route path={`/${POST_DETAIL_MATCH}`} exact component={PublicPostDetail} />
        <Route path='/:context(groups)/:groupSlug' exact component={PublicGroupDetail} />
        <Route path='/:context(public)/:view(map)' component={MapExplorerLayoutRouter} />
        <Route path='/:context(public)/:view(groups)' exact component={GroupExplorerLayoutRouter} />
        {/* Remove this once we show the public stream */}
        <Redirect exact from={`/public/${POST_DETAIL_MATCH}`} to='/post/:postId' />
        <Redirect to={{ pathname: '/public/map', state: { from: location } }} />
      </Switch>
      <HyloCookieConsent />
    </Div100vh>
  )
}

export function PublicGroupDetail (props) {
  const dispatch = useDispatch()
  const routeParams = useParams()
  const history = useHistory()
  const [loading, setLoading] = useState(true)
  const groupSlug = routeParams?.groupSlug
  const checkIsPublicGroup = groupSlug => {
    return {
      type: 'IS_GROUP_PUBLIC',
      graphql: {
        query: gql`
          query CheckIsGroupPublic ($slug: String) {
            group (slug: $slug) {
              visibility
            }
          }
        `,
        variables: { slug: groupSlug }
      },
      meta: { extractModel: 'Group' }
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true)

      const result = await dispatch(checkIsPublicGroup(groupSlug))
      const isPublicGroup = result?.payload?.data?.group?.visibility === 2
      if (!isPublicGroup) {
        history.replace('/login')
      }

      setLoading(false)
    })()
  }, [dispatch, groupSlug])

  if (loading) {
    return <Loading />
  }

  return (
    <div styleName='center-column' id={CENTER_COLUMN_ID}>
      <GroupDetail {...props} />
    </div>
  )
}

export function PublicPostDetail (props) {
  const dispatch = useDispatch()
  const routeParams = useParams()
  const history = useHistory()
  const [loading, setLoading] = useState(true)
  const postId = routeParams?.postId

  const checkIsPostPublic = postId => {
    return {
      type: 'IS_POST_PUBLIC',
      graphql: {
        query: gql`
          query CheckIsPostPublic ($id: ID) {
            post (id: $id) {
              id
            }
          }
        `,
        variables: { id: postId }
      },
      meta: { extractModel: 'Post' }
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true)

      const result = await dispatch(checkIsPostPublic(postId))
      const isPublicPost = result?.payload?.data?.post?.id

      if (!isPublicPost) {
        history.replace('/login')
      }

      setLoading(false)
    })()
  }, [dispatch, postId])

  if (loading) {
    return <Loading />
  }

  return (
    <div styleName='center-column' id={DETAIL_COLUMN_ID}>
      <PostDetail {...props} />
    </div>
  )
}

export function MapExplorerLayoutRouter (props) {
  const history = useHistory()

  return (
    <>
      <div styleName='center-column' id={CENTER_COLUMN_ID}>
        <MapExplorer {...props} history={history} />
      </div>
      <Route
        path={`(.*)/${POST_DETAIL_MATCH}`}
        render={routeProps => (
          <div styleName='detail' id={DETAIL_COLUMN_ID}>
            <PostDetail {...routeProps} />
          </div>
        )}
      />
      <Route
        path={`(.*)/${GROUP_DETAIL_MATCH}`}
        render={routeProps => (
          <div styleName='detail' id={DETAIL_COLUMN_ID}>
            <GroupDetail {...routeProps} />
          </div>
        )}
      />
    </>
  )
}

export function GroupExplorerLayoutRouter () {
  return (
    <>
      <div styleName='center-column' id={CENTER_COLUMN_ID}>
        <GroupExplorer />
      </div>
      <Route
        path={`(.*)/${GROUP_DETAIL_MATCH}`}
        render={routeProps => (
          <div styleName='detail' id={DETAIL_COLUMN_ID}>
            <GroupDetail {...routeProps} />
          </div>
        )}
      />
    </>
  )
}

export function PublicPageHeader () {
  return (
    <div styleName='background'>
      <div styleName='header'>
        <a href='/'>
          <img styleName='logo' src='/assets/navy-merkaba.svg' alt='Hylo logo' />
        </a>
        <div styleName='access-controls'>
          <a href='/login'>Sign in</a>
          <a styleName='sign-up' href='/signup'>Join Hylo</a>
        </div>
      </div>
    </div>
  )
}
