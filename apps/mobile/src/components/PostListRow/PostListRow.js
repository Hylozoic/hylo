import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { DateTime } from 'luxon'

import { modalScreenName } from 'hooks/useIsModalScreen'
import Avatar from 'components/Avatar'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import { personUrl } from '@hylo/navigation'

const PostListRow = (props) => {
  const {
    childPost,
    currentGroupId,
    post,
    expanded,
    slug
  } = props

  const {
    title,
    details,
    creator,
    createdTimestamp,
    commentersTotal
  } = post

  const navigation = useNavigation()

  if (!creator) {
    return null
  }

  const typeLowercase = post.type.toLowerCase()
  const typeName = post.type.charAt(0).toUpperCase() + typeLowercase.slice(1)

  const creatorUrl = personUrl(creator.id, slug)
  const numOtherCommentors = commentersTotal - 1
  const unread = false
  const start = DateTime.fromJSDate(post.startTime)
  const isFlagged = post.flaggedGroups && post.flaggedGroups.includes(currentGroupId)
  const { t } = useTranslation()

  return (
    <TouchableOpacity
      style={[
        styles.postRow,
        unread && styles.unread,
        expanded && styles.expanded
      ]}
      onPress={() => navigation.navigate(modalScreenName('Post Details'), { id: post.id })}
    >
      <View style={styles.contentSummary}>
        <View style={styles.typeAuthor}>
          {isFlagged && <Icon name='Flag' style={styles.flagIcon} />}
          <View style={[styles.postType, styles[post.type.toLowerCase()]]}>
            <Icon name={typeName} />
          </View>
          <View style={styles.participants}>
            {post.type === 'event'
              ? (
                <View style={styles.date}>
                  <Text style={styles.dateText}>{start.toFormat('MMM')}</Text>
                  <Text style={styles.dateText}>{start.toFormat('D')}</Text>
                </View>
                )
              : (
                <View style={styles.participantsContent}>
                  <Avatar avatarUrl={creator.avatarUrl} style={styles.avatar} url={creatorUrl} tiny />
                  <Text style={styles.participantsText}>
                    {creator.name} {
                      numOtherCommentors > 1 && (
                        <>
                          {' '}
                          {t('and')}{' '}
                          <Text style={styles.bold}>
                            {numOtherCommentors} {t('others')}
                          </Text>
                        </>
                      )
                    }
                  </Text>
                </View>
                )}
          </View>
          {childPost && (
            <View style={styles.iconContainer}>
              <Icon name='Subgroup' style={styles.icon} />
            </View>
          )}
          <Text style={[styles.timestamp, !childPost && styles.pushToRight]}>
            {createdTimestamp}
          </Text>
        </View>
        <Text style={[styles.title, isFlagged && !post.clickthrough && styles.isFlagged]}>
          {title}
        </Text>
        <HyloHTML style={styles.details} html={details.length > 200 ? details.slice(0, 200) + '...' : details} />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  postRow: {
    flexDirection: 'row',
    position: 'relative',
    marginLeft: 0,
    padding: 12,
    backgroundColor: 'white',
    shadowColor: 'rgb(35, 65, 91)',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(35, 65, 91, 0.1)'
  },
  iconContainer: {
    backgroundColor: 'white',
    shadowColor: 'rgba(47, 63, 87, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
    borderRadius: 5,
    padding: 2,
    height: 24,
    marginLeft: 'auto',
    marginRight: 4
  },
  icon: {
    fontSize: 12,
    padding: 2
  },
  reactions: {
    padding: 0
  },
  typeAuthor: {
    flexDirection: 'row',
    alignItems: 'flex-end'
  },
  postType: {
    borderRadius: 3,
    padding: 2,
    paddingTop: 0,
    marginRight: 5
  },
  chat: { borderColor: 'rgba(58, 160, 223, 0.25)', borderWidth: 1 },
  discussion: { borderColor: 'rgba(58, 160, 223, 0.25)', borderWidth: 1 },
  event: { borderColor: 'rgba(237, 86, 83, 0.25)', borderWidth: 1 },
  offer: { borderColor: 'rgba(0, 196, 159, 0.25)', borderWidth: 1 },
  resource: { borderColor: 'rgba(254, 214, 55, 0.25)', borderWidth: 1 },
  project: { borderColor: 'rgba(238, 134, 14, 0.25)', borderWidth: 1 },
  request: { borderColor: 'rgba(98, 75, 162, 0.25)', borderWidth: 1 },
  proposal: { borderColor: 'rgba(58, 160, 223, 0.25)', borderWidth: 1 },
  contentSummary: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden'
  },
  participants: {
    fontSize: 12,
    color: '#8C9DAE'
  },
  participantsContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  participantsText: {
    fontSize: 12,
    color: '#8C9DAE'
  },
  avatar: {
    marginRight: 5
  },
  title: {
    color: '#2F3D4C',
    fontSize: 16,
    marginTop: 0,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center'
  },
  details: {
    color: '#5F6C7D',
    width: '100%',
    maxHeight: 18,
    overflow: 'hidden',
    marginBottom: 4
  },
  topic: {
    color: '#00BF8F',
    marginRight: 10
  },
  timestamp: {
    fontSize: 12,
    color: '#8C9DAE'
  },
  pushToRight: {
    marginLeft: 'auto'
  },
  expanded: {
    margin: -6,
    backgroundColor: 'white',
    padding: 17,
    zIndex: 10,
    borderRadius: 5,
    shadowColor: 'rgba(35, 65, 91, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 118, 223, 0.5)',
    borderTopWidth: 3
  },
  isFlagged: {
    opacity: 0.3 // React Native doesn't support blur, so we use opacity instead
  },
  flagIcon: {
    marginTop: 1,
    marginRight: 12,
    fontSize: 24,
    color: '#ED5653',
    fontWeight: 'bold'
  },
  date: {
    flexDirection: 'row'
  },
  dateText: {
    fontSize: 12,
    color: '#8C9DAE'
  },
  topics: {
    flexDirection: 'row',
    marginBottom: 0,
    opacity: 0.5
  },
  bold: {
    fontWeight: 'bold'
  }
})

export default PostListRow
