import React from 'react'
import { useNavigation } from '@react-navigation/native'
import { ALL_GROUPS_CONTEXT_SLUG } from '@hylo/shared'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import HyloWebView from 'components/HyloWebView'

export default function AllTopicsWebView () {
  const navigation = useNavigation()
  const [{ currentGroup }] = useCurrentGroup()
  const path = currentGroup?.slug === ALL_GROUPS_CONTEXT_SLUG
    ? `/${currentGroup?.slug}/topics`
    : `/groups/${currentGroup?.slug}/topics`

  const nativeRouteHandler = () => ({
    '/:groupSlug(all)/topics/:topicName': ({ routeParams: { topicName } }) => {
      navigation.navigate('Stream', { topicName })
    },
    '(.*)/topics/:topicName': ({ routeParams: { topicName } }) => {
      navigation.navigate('Chat Room', { topicName })
    }
  })

  return (
    <HyloWebView
      nativeRouteHandler={nativeRouteHandler}
      path={path}
    />
  )
}
