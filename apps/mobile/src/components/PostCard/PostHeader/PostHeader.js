import React, { useState } from 'react'
import { get } from 'lodash/fp'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { DateTimeHelpers } from '@hylo/shared'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRolesForGroup from '@hylo/hooks/useRolesForGroup'
import useHasResponsibility from '@hylo/hooks/useHasResponsibility'
import usePostActionSheet from 'hooks/usePostActionSheet'
import CondensingBadgeRow from 'components/CondensingBadgeRow'
import Avatar from 'components/Avatar'
import FlagContent from 'components/FlagContent'
import FlagGroupContent from 'components/FlagGroupContent'
import Icon from 'components/Icon'
import styles, { labelStyles } from './PostHeader.styles'

export default function PostHeader ({
  announcement,
  closeOnDelete,
  creator,
  date,
  isFlagged,
  hideMenu,
  postId,
  showMember,
  smallAvatar,
  style,
  title,
  type
}) {
  const navigation = useNavigation()
  const [flaggingVisible, setFlaggingVisible] = useState(false)
  const { showPostActionSheet } = usePostActionSheet({
    postId,
    creator,
    title,
    closeOnDelete,
    setFlaggingVisible
  })
  const [{ currentGroup }] = useCurrentGroup()
  const handleShowMember = () => showMember && showMember(creator.id)

  const creatorHasResponsibility = useHasResponsibility({ person: creator, forCurrentGroup: true })
  // // TODO: URQL - Steward case? -- https://terrans.slack.com/archives/G01HM5VHD8X/p1732263229830789
  // if (responsibility === null) {
  //   // TODO: Shouldn't the '1', etc values be taken from constants?
  //   return responsibilities.some(r => ['1', '3', '4'].includes(r.id))
  // }
  const creatorIsSteward = creatorHasResponsibility(null)
  const badges = useRolesForGroup(currentGroup?.id, creator)
  const { avatarUrl, name } = creator
  const handleFlagOnPress = () => navigation.navigate('Moderation', {
    streamType: 'moderation',
    initial: false,
    options: {
      title: 'Moderation'
    }
  })

  return (
    <View style={[styles.container, style]}>
      <View style={styles.avatarSpacing}>
        <TouchableOpacity onPress={handleShowMember}>
          {!!avatarUrl && <Avatar avatarUrl={avatarUrl} dimension={smallAvatar ? 24 : 24} />}
        </TouchableOpacity>
      </View>
      <View style={styles.nameAndDate}>
        <TouchableOpacity onPress={handleShowMember}>
          {name && (
            <Text style={styles.name}>{name}</Text>
          )}
        </TouchableOpacity>
        <CondensingBadgeRow badges={badges || []} creatorIsSteward={creatorIsSteward} currentGroup={currentGroup} postId={postId} />
        <Text style={styles.date}>{DateTimeHelpers.humanDate(date)}</Text>
      </View>
      <View style={styles.upperRight}>
        {isFlagged && (
          <TouchableOpacity hitSlop={5} onPress={handleFlagOnPress}>
            <Icon name='Flag' style={styles.flagIcon} />
          </TouchableOpacity>
        )}
        {announcement && (
          <Icon name='Announcement' style={styles.announcementIcon} />
        )}
        {type && (
          <PostLabel type={type} condensed={isFlagged} />
        )}
        {!hideMenu && (
          <TouchableOpacity
            onPress={showPostActionSheet}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Icon name='More' style={styles.moreIcon} />
          </TouchableOpacity>
        )}
        {flaggingVisible && !currentGroup?.id && (
          <FlagContent
            type='post'
            linkData={{
              slug: currentGroup?.slug,
              id: postId,
              type: 'post'
            }}
            onClose={() => setFlaggingVisible(false)}
          />
        )}
        {flaggingVisible && currentGroup?.id && (
          <FlagGroupContent
            type='post'
            linkData={{
              slug: currentGroup?.slug,
              id: postId,
              type: 'post'
            }}
            onClose={() => setFlaggingVisible(false)}
          />
        )}
      </View>
    </View>
  )
}

export function PostLabel ({ type, condensed }) {
  const { t } = useTranslation()
  const labelTypeStyle = get(type, labelStyles) || labelStyles.discussion
  const boxStyle = [labelStyles.box, labelTypeStyle.box]
  const textStyle = [labelStyles.text, labelTypeStyle.text]

  // explicit invocations of dynamic content
  t('discussion')
  t('event')
  t('project')
  t('proposal')
  t('offer')
  t('request')
  t('resource')

  return (
    <View style={boxStyle}>
      <Text style={textStyle}>
        {condensed
          ? `${t(type).toUpperCase().slice(0, 4)}.`
          : t(type).toUpperCase()}
      </Text>
    </View>
  )
}
