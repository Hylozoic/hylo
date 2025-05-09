import React from 'react'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import HyloWebView from 'components/HyloWebView'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'

export const DEFAULT_CHAT_TOPIC = 'general'

export default function ChatRoomWebView () {
  const [{ currentGroup, fetching }] = useCurrentGroup()
  const { topicName: routeTopicName } = useRouteParams()
  const topicName = routeTopicName || DEFAULT_CHAT_TOPIC
  const path = `/groups/${currentGroup?.slug}/chat/${topicName}`

  if (!currentGroup?.slug || fetching) return null

  return (
    <KeyboardFriendlyView style={{ flex: 1 }}>
      <HyloWebView path={path} />
    </KeyboardFriendlyView>
  )
}
