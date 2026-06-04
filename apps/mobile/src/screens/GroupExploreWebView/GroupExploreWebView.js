// DEPRECATED: This screen is no longer used in the app.
// All content (including group exploration) is now handled by PrimaryWebView.
// The web app provides the group exploration interface.
// Kept for reference - may revisit native implementation in the future.
// Last used: 2025-01-26

import React, { useRef, useEffect, useState } from 'react'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { gql, useQuery } from 'urql'
import { URL } from 'react-native-url-polyfill'
import { WebViewMessageTypes } from '@hylo/shared'
import { DEFAULT_APP_HOST } from 'navigation/linking'
import groupDetailsQueryMaker from '@hylo/graphql/queries/groupDetailsQueryMaker'
import useGroup from '@hylo/hooks/useGroup'
import useOpenURL from 'hooks/useOpenURL'
import useIsModalScreen from 'hooks/useIsModalScreen'
import useRouteParams from 'hooks/useRouteParams'
import ModalHeaderTransparent from 'navigation/headers/ModalHeaderTransparent'
import HyloWebView from 'components/HyloWebView'

const groupStewardsQuery = gql`
  query GroupStewardsQuery ($id: ID, $slug: String) {
    group (id: $id, slug: $slug) {
      id
      stewards {
        items {
          id
          name
          avatarUrl
        }
      }
    }
  }
`
export default function GroupExploreWebView () {
  const navigation = useNavigation()
  const openURL = useOpenURL()
  const isModalScreen = useIsModalScreen()
  const webViewRef = useRef(null)
  const { groupSlug } = useRouteParams()
  const [, fetchGroupDetails] = useQuery({ query: groupDetailsQueryMaker(), pause: true })
  const [, fetchGroupModerators] = useQuery({ query: groupStewardsQuery, pause: true })
  const [{ group }] = useGroup({ groupSlug })
  const [path, setPath] = useState()
  const [canGoBack, setCanGoBack] = useState(false)

  useFocusEffect(
    () => {
      isModalScreen
        ? navigation.setOptions(ModalHeaderTransparent({ navigation }))
        : navigation.setOptions({
          title: group?.name,
          headerLeftOnPress:
            canGoBack ? webViewRef.current.goBack : navigation.goBack
        })
    }
  )

  useEffect(() => {
    if (groupSlug) {
      setPath(`/public/groups/group/${groupSlug}`)
      // Fetch stewards for "Opportunities to Connect" / Message to all stewards feature
      fetchGroupModerators({ slug: groupSlug })
    }
  }, [groupSlug])

  const joinGroup = async groupToJoinSlug => {
    await fetchGroupDetails({ slug: groupToJoinSlug })
    openURL(`/groups/${groupToJoinSlug}`)
  }

  const messageHandler = ({ type, data }) => {
    switch (type) {
      case WebViewMessageTypes.JOINED_GROUP: {
        const { groupSlug } = data
        return joinGroup(groupSlug)
      }
    }
  }

  const handledWebRoutes = [
    // '(.*)/explore/group/(.*)'
  ]

  if (!groupSlug) return null

  return (
    <HyloWebView
      ref={webViewRef}
      path={path}
      handledWebRoutes={handledWebRoutes}
      messageHandler={messageHandler}
      // TODO: Consider adding this to the `HyloWebView` standard API
      onNavigationStateChange={({ url, canGoBack: providedCanGoBack }) => {
        const { pathname } = new URL(url, DEFAULT_APP_HOST)
        // NOTE: Currently ignores possible changes to querystring (`search`)
        setCanGoBack(providedCanGoBack && pathname !== path)
      }}
    />
  )
}
