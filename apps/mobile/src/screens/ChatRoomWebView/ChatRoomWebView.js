import React, { useEffect } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import { modalScreenName } from 'hooks/useIsModalScreen'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import HyloWebView from 'components/HyloWebView'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'

export default function ChatRoomWebView () {
  const navigation = useNavigation()
  const route = useRoute()
  const [{ currentGroup }] = useCurrentGroup()
  const { topicName } = useRouteParams()
  const path = `/groups/${currentGroup.slug}/chat/${topicName}`
  const handledWebRoutes = [
    `/groups/${currentGroup.slug}/chat/:topicName`
  ]
  const nativeRouteHandler = () => ({
    '(.*)/:type(post|members)/:id': ({ routeParams }) => {
      const { type, id } = routeParams

      switch (type) {
        case 'post': {
          navigation.navigate('Post Details', { id })
          break
        }
        case 'members': {
          navigation.navigate('Member', { id })
          break
        }
      }
    },
    '(.*)/post/:postId/edit': ({ routeParams }) => {
      navigation.navigate('Edit Post', { id: routeParams.postId })
    },
    '(.*)/group/:groupSlug([a-zA-Z0-9-]+)': ({ routeParams }) => {
      navigation.navigate(modalScreenName('Group Explore'), routeParams)
    }
  })

  useEffect(() => {
    navigation.setOptions({ title: currentGroup?.name })
  }, [currentGroup?.name])

  return (
    <KeyboardFriendlyView style={{ flex: 1 }}>
      <HyloWebView
        handledWebRoutes={handledWebRoutes}
        nativeRouteHandler={nativeRouteHandler}
        path={path}
        route={route}
      />
    </KeyboardFriendlyView>
  )
}
