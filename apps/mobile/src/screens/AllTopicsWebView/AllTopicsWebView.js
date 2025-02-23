import React, { useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import HyloWebView from 'components/HyloWebView'

export default function AllTopicsWebView () {
  const navigation = useNavigation()
  const [{ currentGroup }] = useCurrentGroup()
  const path = currentGroup?.slug === 'all'
    ? `/${currentGroup?.slug}/topics`
    : `/groups/${currentGroup?.slug}/topics`

  const nativeRouteHandler = () => ({
    '/:groupSlug(all)/topics/:topicName': ({ routeParams: { topicName } }) => {
      navigation.navigate('Stream', { topicName })
    },
    '(.*)/topics/:topicName': ({ routeParams: { topicName } }) => {
      navigation.navigate('ChatRoom', { topicName })
    }
  })

  useEffect(() => {
    navigation.setOptions({ title: currentGroup?.name })
  }, [currentGroup?.name])

  return (
    <HyloWebView
      nativeRouteHandler={nativeRouteHandler}
      path={path}
    />
  )
}
