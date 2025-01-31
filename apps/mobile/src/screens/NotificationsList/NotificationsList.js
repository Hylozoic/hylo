import React, { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'urql'
import { FlatList, TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
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
import Loading from 'components/Loading'
import cardStyles from 'components/NotificationCard/NotificationCard.styles'
import notificationsQuery from '@hylo/graphql/queries/notificationsQuery'
import resetNotificationsCountMutation from '@hylo/graphql/mutations/resetNotificationsCountMutation'
import useCurrentUser from '@hylo/hooks/useCurrentUser'

const styles = StyleSheet.create({
  notificationsList: {
    backgroundColor: 'white',
    position: 'relative'
  },
  center: {
    padding: 20
  }
})

export default function NotificationsList (props) {
  const navigation = useNavigation()
  const isFocused = useIsFocused()
  const { t } = useTranslation()
  const [offset, setOffset] = useState(0)
  const [, resetNotificationsCount] = useMutation(resetNotificationsCountMutation)
  const [, markActivityRead] = useMutation(markActivityReadMutation)
  // TODO: markAllActivitiesRead needs to optimistically updated
  const [, markAllActivitiesRead] = useMutation(markAllActivitiesReadMutation)
  const [{ currentUser }] = useCurrentUser()
  const [{ data, fetching }] = useQuery({ query: notificationsQuery, variables: { offset } })

  const notifications = refineNotifications(data?.notifications?.items, navigation)
  const hasMore = notifications?.hasMore
  const memberships = currentUser?.memberships
  const currentUserHasMemberships = !isEmpty(memberships)
  const setHeader = () => {
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
  }

  const goToCreateGroup = () => navigation.navigate('Create Group')

  useEffect(() => {
    setHeader()
    resetNotificationsCount()
  }, [])

  useEffect(() => {
    if (isFocused) {
      setHeader()
      resetNotificationsCount()
    }
  }, [isFocused])

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
      {fetching && (
        <View style={cardStyles.container}>
          <View style={cardStyles.content}>
            <Loading />
          </View>
        </View>
      )}
      <FlatList
        data={notifications}
        keyExtractor={keyExtractor}
        onEndReached={hasMore ? () => setOffset(notifications?.length) : null}
        renderItem={({ item }) =>
          <NotificationRow
            markActivityRead={markActivityRead}
            notification={item}
          />}
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
