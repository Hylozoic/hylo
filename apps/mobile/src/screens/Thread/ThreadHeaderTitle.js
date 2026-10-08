import React, { useRef } from 'react'
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { modalScreenName } from 'hooks/useIsModalScreen'
import { firstName } from '@hylo/presenters/PersonPresenter'
import Avatar from 'components/Avatar'
import PeopleListModal from 'components/PeopleListModal'
import { rhino } from '@hylo/presenters/colors'

export default function ThreadHeaderTitle ({ thread, currentUserId }) {
  const navigation = useNavigation()
  const { t } = useTranslation()
  const peoplePopupRef = useRef()

  if (!thread) return null

  const otherParticipants = thread.participants.filter(p => p.id !== currentUserId)
  const avatarUrls = otherParticipants.map(p => p.avatarUrl)
  const names = otherParticipants.length > 1 ? otherParticipants.map(firstName) : [otherParticipants[0]?.name || 'Deleted User']
  const goToParticipant = ({ id }) => navigation.navigate(modalScreenName('Member'), { id })
  const handleOnPress = () => {
    otherParticipants.length > 1
      ? peoplePopupRef?.current.show()
      : otherParticipants[0] && goToParticipant(otherParticipants[0])
  }

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity onPress={handleOnPress}>
          <View style={styles.title}>
            {avatarUrls.slice(0, 3).map((avatarUrl, index) => {
              return (
                <Avatar
                  key={index}
                  avatarUrl={avatarUrl}
                  size='small'
                  hasBorder={false}
                  hasOverlap={avatarUrls.length > 1}
                  zIndex={3 - index}
                />
              )
            })}
            <Text style={styles.participantNames}>{participantNamesSummary(names, t)}</Text>
          </View>
        </TouchableOpacity>
        <PeopleListModal
          ref={peoplePopupRef}
          title={t('Participants')}
          onItemPress={goToParticipant}
          items={otherParticipants}
        />
      </View>
    </>
  )
}

export function participantNamesSummary (names, t) {
  if (names.length < 3) return names.join(' & ')
  return `${names[0]} & ${names.length - 1} ${t('others')}`
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40
  },
  title: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  participantNames: {
    paddingLeft: 10,
    color: rhino,
    fontSize: 18,
    fontFamily: 'Circular-Bold'
  }
})
