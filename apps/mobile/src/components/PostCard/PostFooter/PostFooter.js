// DEPRECATED: This component is only used by deprecated screens (PostCard, PostDetails, etc.)
// Kept for reference only.

import React, { useRef } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { get, find, filter, isEmpty, sortBy } from 'lodash/fp'
// DEPRECATED: react-native-linear-gradient removed
// import LinearGradient from 'react-native-linear-gradient'
import { RESPONSES } from '@hylo/presenters/EventInvitationPresenter'
import Avatar from 'components/Avatar'
import PeopleListModal from 'components/PeopleListModal'
import { postCardLinearGradientColors, rhino40 } from '@hylo/presenters/colors'

export default function PostFooter ({
  commenters,
  commentersTotal,
  currentUser,
  eventInvitations,
  members,
  onPress,
  forDetails,
  style,
  type
}) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const peopleListRef = useRef()
  const goToMember = person => navigation.navigate('Member', { id: person.id })
  const eventAttendees = filter(ei => ei?.response === RESPONSES.YES, eventInvitations)
  const showPeopleList = () => peopleListRef.current.show()

  let peopleRowResult

  switch (type) {
    case 'project':
      peopleRowResult = peopleSetup(
        members,
        members.length,
        get('id', currentUser),
        {
          emptyMessage: t('No project members'),
          phraseSingular: t('is a member'),
          mePhraseSingular: t('are a member'),
          pluralPhrase: t('are members')
        }
      )
      break
    case 'event':
      peopleRowResult = peopleSetup(
        eventAttendees,
        eventAttendees.length,
        get('id', currentUser),
        {
          emptyMessage: t('No one is attending yet'),
          phraseSingular: t('is attending'),
          mePhraseSingular: t('are attending'),
          pluralPhrase: t('attending')
        }
      )
      break
    default:
      peopleRowResult = peopleSetup(
        commenters,
        commentersTotal,
        get('id', currentUser),
        {
          emptyMessage: t('Be the first to comment'),
          phraseSingular: t('commented'),
          mePhraseSingular: t('commented'),
          pluralPhrase: t('commented')
        }
      )
  }

  const { caption, avatarUrls, sortedPeople } = peopleRowResult

  return (
    <>
      <View style={styles.dashedBorder} />
      {/* DEPRECATED: LinearGradient removed, replaced with View */}
      {/* <LinearGradient style={[styles.gradient, style]} colors={postCardLinearGradientColors}> */}
      <View style={[styles.gradient, style]}>
        <View style={styles.container}>
          <PeopleListModal
            ref={peopleListRef}
            title={t('Commenters')}
            onItemPress={goToMember}
            items={sortedPeople}
          />
          <TouchableOpacity onPress={showPeopleList} onLongPress={showPeopleList} style={styles.comments}>
            {avatarUrls.slice(0, 3).map((avatarUrl, index) => {
              return (
                <Avatar
                  key={index}
                  avatarUrl={avatarUrl}
                  size='small'
                  hasBorder
                  hasOverlap={index > 0}
                  zIndex={3 - index}
                />
              )
            })}
            <Text style={[styles.commentsText, !isEmpty(avatarUrls) && styles.commentsTextWithAvatars]}>{caption}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* </LinearGradient> */}
      {forDetails && (
        <View style={styles.dashedBorder} />
      )}
    </>
  )
}

export const peopleSetup = (
  people,
  peopleTotal,
  excludePersonId,
  // these are default phases and are never used, so I'm not translating them
  phrases = {
    emptyMessage: 'Be the first to comment',
    phraseSingular: 'commented',
    mePhraseSingular: 'commented',
    pluralPhrase: 'commented'
  }
) => {
  const { t } = useTranslation()
  const currentUserIsMember = find(c => c.id === excludePersonId, people)
  const sortedPeople = currentUserIsMember && people.length === 2
    ? sortBy(c => c.id !== excludePersonId, people) // me first
    : sortBy(c => c.id === excludePersonId, people) // me last
  const firstName = person => person.id === excludePersonId ? t('You') : person.name.split(' ')[0]
  const {
    emptyMessage,
    phraseSingular,
    mePhraseSingular,
    pluralPhrase
  } = phrases
  let names = ''
  let phrase = pluralPhrase

  if (sortedPeople.length === 0) return { caption: emptyMessage, avatarUrls: [] }
  if (sortedPeople.length === 1) {
    phrase = currentUserIsMember ? mePhraseSingular : phraseSingular
    names = firstName(sortedPeople[0])
  } else if (sortedPeople.length === 2) {
    names = `${firstName(sortedPeople[0])} and ${firstName(sortedPeople[1])}`
  } else {
    // names = `${firstName(sortedPeople[0])}, ${firstName(sortedPeople[1])} ${t('and')} ${peopleTotal - 2} ${t('other')}${peopleTotal - 2 > 1 ? 's' : ''}`
    names = t('manyCommentersInTheFooter', { firstPerson: firstName(sortedPeople[0]), secondPerson: firstName(sortedPeople[1]), count: peopleTotal - 2 })
    // names = t('manyCommentersInTheFooter', { count: peopleTotal - 2 })
  }
  const caption = `${names} ${phrase}`
  const avatarUrls = people.map(p => p.avatarUrl)
  return { caption, avatarUrls, sortedPeople, pluralPhrase }
}

const styles = {
  gradient: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  container: {
    paddingLeft: 12,
    paddingVertical: 8
  },
  dashedBorder: {
    height: 1,
    width: '100%',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: 'rgba(54, 61, 60, 0.1)',
    borderStyle: 'dashed'
  },
  comments: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  commentsText: {
    color: rhino40,
    fontSize: 13,
    fontFamily: 'Circular-Book'
  },
  commentsTextWithAvatars: {
    paddingLeft: 5
  }
}
