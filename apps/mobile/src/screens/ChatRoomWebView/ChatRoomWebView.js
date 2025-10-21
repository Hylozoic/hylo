import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import { isStaticContext } from '@hylo/presenters/GroupPresenter'
import useRouteParams from 'hooks/useRouteParams'
import HyloWebView from 'components/HyloWebView'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'

export const DEFAULT_CHAT_TOPIC = 'general'

export default function ChatRoomWebView () {
  const [{ currentGroup, fetching }] = useCurrentGroup()
  const { topicName: routeTopicName } = useRouteParams()
  const topicName = routeTopicName || DEFAULT_CHAT_TOPIC
  const insets = useSafeAreaInsets()

  // Chat rooms only exist for actual groups, not for static contexts like 'public' or 'my'
  if (!currentGroup?.slug || fetching || isStaticContext(currentGroup?.slug)) return null

  const path = `/groups/${currentGroup.slug}/chat/${topicName}`

  return (
    <KeyboardFriendlyView 
      style={{ flex: 1 }}
      keyboardVerticalOffset={insets.bottom + 80}
    >
      <HyloWebView path={path} />
    </KeyboardFriendlyView>
  )
}
