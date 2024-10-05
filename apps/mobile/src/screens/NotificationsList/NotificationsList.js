import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { FlatList, TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import ModalHeader from 'navigation/headers/ModalHeader'
import NotificationCard from 'components/NotificationCard'
import CreateGroupNotice from 'components/CreateGroupNotice'
import Loading from 'components/Loading'
import cardStyles from 'components/NotificationCard/NotificationCard.styles'
import {
  FETCH_NOTIFICATIONS,
  fetchNotifications,
  getNotifications,
  getHasMoreNotifications,
  markActivityRead,
  markAllActivitiesRead,
  updateNewNotificationCount
} from './NotificationsList.store'
import getMemberships from 'store/selectors/getMemberships'
import { isEmpty } from 'lodash'

const NOTIFICATIONS_PAGE_SIZE = 20

const styles = StyleSheet.create({
  notificationsList: {
    backgroundColor: 'white',
    position: 'relative'
  },
  center: {
    padding: 20
  }
})

export const NotificationsList = props => {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const isFocused = useIsFocused()

  const [ready, setReady] = useState(false)

  const hasMore = useSelector(getHasMoreNotifications)
  const pending = useSelector(state => state.pending[FETCH_NOTIFICATIONS])
  const notifications = useSelector(state => getNotifications(state, props))
  const currentUserHasMemberships = useSelector(state => !isEmpty(getMemberships(state)))

  const fetchNotificationsHandler = () => dispatch(fetchNotifications(NOTIFICATIONS_PAGE_SIZE))
  const fetchMoreHandler = offset => dispatch(fetchNotifications(NOTIFICATIONS_PAGE_SIZE, offset))
  const markAllActivitiesReadHandler = () => dispatch(markAllActivitiesRead())
  const markActivityReadHandler = id => dispatch(markActivityRead(id))
  const updateNewNotificationCountHandler = () => dispatch(updateNewNotificationCount())

  const goToCreateGroupHandler = () => navigation.navigate('Create Group')

  const setHeader = () => {
    navigation.setOptions({
      title: t('Notifications'),
      header: props => (
        <ModalHeader
          {...props}
          headerRightButtonLabel={t('Mark as read')}
          headerRightButtonOnPress={markAllActivitiesReadHandler}
        />
      )
    })
  }

  useEffect(() => {
    setHeader()
    fetchNotificationsHandler()
    updateNewNotificationCountHandler()
  }, [])

  useEffect(() => {
    if (isFocused) {
      setHeader()
      fetchNotificationsHandler()
      updateNewNotificationCountHandler()
    }
  }, [isFocused])

  useEffect(() => {
    if (!pending) {
      setReady(true)
    }
  }, [pending])

  if (!currentUserHasMemberships) {
    return (
      <CreateGroupNotice
        goToCreateGroup={goToCreateGroupHandler}
        text={t('No notifications here, try creating your own Group!')}
      />
    )
  }

  if (ready && !pending && notifications.length === 0) {
    return <Text style={styles.center}>{t('Nothing new for you!')}</Text>
  }

  return (
    <View style={styles.notificationsList}>
      {pending && (
        <View style={cardStyles.container}>
          <View style={cardStyles.content}>
            <Loading />
          </View>
        </View>
      )}
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        onEndReached={hasMore ? () => fetchMoreHandler(notifications.length) : null}
        renderItem={({ item }) => (
          <NotificationRow
            markActivityRead={markActivityReadHandler}
            notification={item}
          />
        )}
      />
    </View>
  )
}

export const NotificationRow = ({ markActivityRead, notification }) => {
  return (
    <View>
      <TouchableOpacity
        onPress={() => {
          if (notification.unread) markActivityRead(notification.activityId)
          notification.onPress()
        }}
      >
        <NotificationCard notification={notification} />
      </TouchableOpacity>
    </View>
  )
}

export default NotificationsList
