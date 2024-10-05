import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigation } from '@react-navigation/native'
import getCurrentGroup from 'store/selectors/getCurrentGroup'
import HyloWebView from 'components/HyloWebView'

export default function AllTopicsWebView () {
  const navigation = useNavigation()
  const currentGroup = useSelector(getCurrentGroup)
  const path = currentGroup?.slug === 'all'
    ? `/${currentGroup?.slug}/topics`
    : `/groups/${currentGroup?.slug}/topics`

  const nativeRouteHandler = () => ({
    '/:groupSlug(all)/topics/:topicName': ({ routeParams: { topicName } }) => {
      navigation.navigate('Stream', { topicName })
    },
    '(.*)/topics/:topicName': ({ routeParams: { topicName } }) => {
      navigation.navigate('Chat', { topicName })
    }
  })

  useEffect(() => {
    navigation.setOptions({ headerTitle: currentGroup?.name })
  }, [currentGroup?.name])

  return (
    <HyloWebView
      nativeRouteHandler={nativeRouteHandler}
      path={path}
    />
  )
}
