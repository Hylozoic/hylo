import React, { useCallback, useState } from 'react'
import { useMutation, useQuery } from 'urql'
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { isEmpty } from 'lodash'
import {
  markActivityReadMutation,
  markAllActivitiesReadMutation,
  refineNotifications
} from './NotificationsList.store'
import ModalHeader from 'navigation/headers/ModalHeader'
import NotificationCard from 'components/NotificationCard'
import CreateGroupNotice from 'components/CreateGroupNotice'
import notificationsQuery from '@hylo/graphql/queries/notificationsQuery'
import resetNotificationsCountMutation from '@hylo/graphql/mutations/resetNotificationsCountMutation'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { alabaster } from 'style/colors'

const styles = StyleSheet.create({
  notificationsList: {
    flex: 1,
    backgroundColor: alabaster,
    position: 'relative'
  },
  center: {
    padding: 20
  }
})

export default function NotificationsList (props) {
  const navigation = useNavigation()
  const { t } = useTranslation()
  const [offset, setOffset] = useState(0)
  const [, resetNotificationsCount] = useMutation(resetNotificationsCountMutation)
  const [, markActivityRead] = useMutation(markActivityReadMutation)
  const [, markAllActivitiesRead] = useMutation(markAllActivitiesReadMutation)
  const [{ currentUser }] = useCurrentUser()
  const [{ data, fetching, stale }, fetchNotifications] = useQuery({
    query: notificationsQuery,
    variables: { offset }
  })

  const refreshNotifications = async () => {
    setOffset(0)
    fetchNotifications({ requestPolicy: 'network-only' })
  }

  const notifications = refineNotifications(data?.notifications?.items, navigation)
  const hasMore = data?.notifications?.hasMore
  const memberships = currentUser?.memberships
  const currentUserHasMemberships = !isEmpty(memberships)

  const goToCreateGroup = () => navigation.navigate('Create Group')

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        title: t('Notifications'),
        header: props => (
          <ModalHeader
            {...props}
            headerRightButtonLabel={t('Mark as read')}
            headerRightButtonOnPress={() => markAllActivitiesRead()}
          />
        )
      })
      resetNotificationsCount()
    }, [])
  )

  const keyExtractor = item => item.id

  if (!currentUserHasMemberships) {
    return (
      <CreateGroupNotice
        goToCreateGroup={goToCreateGroup}
        text={t('No notifications here, try creating your own Group!')}
      />
    )
  }

  if (!fetching && notifications.length === 0) {
    return <Text style={styles.center}>{t('Nothing new for you!')}</Text>
  }

  return (
    <View style={styles.notificationsList}>
      <FlashList
        data={notifications}
        estimatedItemSize={87}
        keyExtractor={keyExtractor}
        onRefresh={refreshNotifications}
        refreshing={fetching || stale}
        onEndReached={hasMore ? () => setOffset(notifications?.length) : null}
        renderItem={({ item }) => (
          <NotificationRow markActivityRead={markActivityRead} notification={item} />
        )}
      />
    </View>
  )
}

export function NotificationRow ({ markActivityRead, notification }) {
  return (
    <View>
      <TouchableOpacity
        onPress={() => {
          if (notification.unread) markActivityRead({ id: notification.activityId })
          notification.onPress()
        }}
      >
        <NotificationCard notification={notification} />
      </TouchableOpacity>
    </View>
  )
}
