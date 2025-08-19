import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { agreementsURL } from 'store/constants'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useHasResponsibility, { RESP_MANAGE_CONTENT } from '@hylo/hooks/useHasResponsibility'
import usePlatformAgreements from '@hylo/hooks/usePlatformAgreements'
import Avatar from 'components/Avatar'
import MultiSelect from 'components/MultiSelect'
import Button from 'components/Button/Button'
import PostListRow from 'components/PostListRow'
import Colors from '../../style/theme-colors'

const ModerationListItem = ({
  moderationAction,
  handleClearModerationAction,
  handleConfirmModerationAction,
  navigateToPost,
  group
}) => {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  const hasResponsibility = useHasResponsibility({ groupId: group.id, forCurrentGroup: true, forCurrentUser: true })
  const canModerate = hasResponsibility(RESP_MANAGE_CONTENT)

  const {
    agreements,
    anonymous,
    post,
    reporter,
    status,
    text
  } = moderationAction

  const platformAgreementsIds = moderationAction.platformAgreements.map(agreement => agreement.id)
  const [allPlatformAgreements, platformAgreementsFetching] = usePlatformAgreements()

  if (platformAgreementsFetching) return null

  const platformAgreements = allPlatformAgreements.filter(agreement => platformAgreementsIds.includes(agreement.id))
  // TODO:  Currently not implemented
  // const reporterUrl = `/user/${reporter.id}`
  const groupAgreementsUrl = group ? groupUrl(group.slug) + `/group/${group.slug}` : ''
  const currentUserIsReporter = reporter.id === currentUser.id
  const navigateToReporter = () => {
    navigation.navigate('UserProfile', { userId: reporter.id })
  }

  return (
    <View style={styles.moderationActionCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.userName}>{t('Reported by')}:</Text>
        {anonymous && !canModerate
          ? (<Text>{t('Anonymous')}</Text>)
          : (
            <View style={styles.reporterInfo}>
              <Avatar
                avatarUrl={reporter.avatarUrl}
                onPress={navigateToReporter}
                style={styles.avatar}
                size='small'
                dimension={24}
              />
              <TouchableOpacity onPress={navigateToReporter}>
                <Text style={styles.userName}>{reporter.name}</Text>
              </TouchableOpacity>
            </View>)}
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.status, styles[status]]}>{t(`status-${status}`)}</Text>
        <Text style={styles.heading}>{t('Complaint')}:</Text>
        <Text style={styles.complaint}>{text}</Text>
        <Text style={styles.heading}>{t('Reported content')}:</Text>
        <PostListRow
          post={post}
          currentGroupId={group && group.id}
          currentUser={currentUser}
          slug={group.slug}
        />
        <View style={styles.agreements}>
          {agreements.length > 0 && (
            <>
              <Text style={styles.heading}>{t('Group Agreements broken')}:</Text>
              <MultiSelect items={agreements} />
              <TouchableOpacity onPress={() => Linking.openURL(groupAgreementsUrl)}>
                <Text style={styles.agreementsLink}>{t('Link to group agreements')}</Text>
              </TouchableOpacity>
            </>)}
          {platformAgreements.length > 0 && (
            <>
              <Text>----</Text>
              <Text style={styles.heading}>{t('Platform Agreements broken')}:</Text>
              <MultiSelect items={platformAgreements} />
              <TouchableOpacity onPress={() => Linking.openURL(agreementsURL)}>
                <Text style={styles.agreementsLink}>{t('Link to platform agreements')}</Text>
              </TouchableOpacity>
            </>)}
        </View>
      </View>

      <View style={styles.cardFooter}>
        {(canModerate || currentUserIsReporter) && status !== 'cleared' && (
          <Button
            onPress={() => handleClearModerationAction({ postId: post.id, moderationActionId: moderationAction.id, groupId: group.id })}
            text={t('Clear')}
            style={{
              fontSize: 16,
              width: 120,
              height: 40,
              borderRadius: 8,
              backgroundColor: Colors.secondary80,
              color: Colors.muted
            }}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  moderationActionCard: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: 'rgba(35, 65, 91, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    backgroundColor: '#fefefe',
    elevation: 5
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(235, 235, 235, 1.0)',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5
  },
  reporterInfo: {
    marginLeft: 4,
    flexDirection: 'row',
    alignItems: 'center'
  },
  complaint: {
    marginBottom: 8
  },
  avatar: {
    width: 30,
    height: 30
  },
  userName: {
    fontWeight: 'bold',
    color: 'rgba(44, 64, 89, 0.8)',
    fontSize: 14
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 16
  },
  bodyText: {
    fontWeight: 'normal',
    color: 'rgba(44, 64, 89, 0.7)',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20
  },
  heading: {
    fontWeight: 'bold',
    color: 'rgba(35, 65, 91, 1.0)',
    fontSize: 16,
    marginBottom: 8
  },
  agreements: {
    marginTop: 16
  },
  agreementsLink: {
    color: '#2C405A',
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: 10
  },
  status: {
    fontSize: 14
  },
  cleared: {
    color: Colors.selected
  },
  active: {
    color: '#f39c12'
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: 52, // $footer-height + 12px
    borderTopWidth: 1,
    borderTopColor: 'rgba(44, 64, 89, 0.1)',
    paddingHorizontal: 8
  }
})

export default ModerationListItem
