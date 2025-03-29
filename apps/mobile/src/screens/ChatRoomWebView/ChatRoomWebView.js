import React from 'react'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import HyloWebView from 'components/HyloWebView'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'

export default function ChatRoomWebView () {
  const [{ currentGroup, fetching }] = useCurrentGroup()
  const { topicName: routeTopicName, originalLinkingPath } = useRouteParams()
  const topicName = routeTopicName || 'home'
  const path = originalLinkingPath || `/groups/${currentGroup?.slug}/chat/${topicName}`
  const handledWebRoutes = [
    `/groups/${currentGroup?.slug}/chat/:topicName`
  ]
  if (fetching) return null

  return (
    <KeyboardFriendlyView style={{ flex: 1 }}>
      <HyloWebView handledWebRoutes={handledWebRoutes} path={path} />
    </KeyboardFriendlyView>
  )
}
