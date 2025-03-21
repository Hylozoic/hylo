import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { isEmpty } from 'lodash/fp'
import { decode } from 'html-entities'
import { TextHelpers, DateTimeHelpers } from '@hylo/shared'
import { humanResponse, RESPONSES } from '@hylo/presenters/EventInvitationPresenter'
import HyloHTML from 'components/HyloHTML'
import EmojiRow from 'components/EmojiRow'
import LinkPreview from 'components/PostCard/LinkPreview'
import Icon from 'components/Icon'
import PopupMenuButton from 'components/PopupMenuButton'
import PostBodyProposal from '../PostBodyProposal'
import { caribbeanGreen, rhino, white, white20onCaribbeanGreen } from 'style/colors'
import { useTranslation } from 'react-i18next'

const MAX_DETAILS_LENGTH = 144

export default function PostBody ({
  type,
  title,
  currentUser,
  details,
  startTime,
  endTime,
  isFlagged,
  post,
  linkPreview,
  // linkPreviewFeatured,
  myEventResponse,
  respondToEvent,
  shouldTruncate
}) {
  const presentedDetails = useMemo(() => {
    return shouldTruncate ? TextHelpers.truncateHTML(details, MAX_DETAILS_LENGTH) : details
  }, [details, shouldTruncate])
  const { t } = useTranslation()

  return (
    <View style={styles.container}>
      {startTime && endTime && (
        <Text style={styles.resourceEndsAt}>{DateTimeHelpers.formatDatePair(startTime, endTime)}</Text>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <PostTitle title={isFlagged ? t('Post flagged') : title} />
        {type === 'event' && !!respondToEvent && (
          <EventRSVP
            myEventResponse={isEmpty(myEventResponse) ? RESPONSES.NO : myEventResponse}
            respondToEvent={respondToEvent}
          />
        )}
      </View>
      <HyloHTML
        html={isFlagged ? '<p>' + t('Contents obscured') + '</p>' : presentedDetails}
        baseStyle={{ marginBottom: 8 }}
      />
      {/* {!linkPreviewFeatured && ( */}
      {type === 'proposal' && <PostBodyProposal {...post} currentUser={currentUser} isFlagged={isFlagged} />}
      <LinkPreview {...linkPreview} />
      {/* )} */}
      <EmojiRow
        post={post}
        currentUser={currentUser}
      />
    </View>
  )
}

export function EventRSVP ({ myEventResponse, respondToEvent }) {
  const { t } = useTranslation()
  const actions = [
    [t(humanResponse(RESPONSES.YES)), () => respondToEvent(RESPONSES.YES)],
    [t(humanResponse(RESPONSES.INTERESTED)), () => respondToEvent(RESPONSES.INTERESTED)],
    [t(humanResponse(RESPONSES.NO)), () => respondToEvent(RESPONSES.NO)]
  ]

  return (
    <PopupMenuButton actions={actions}>
      <View style={styles.RSVPOption}>
        <Text style={styles.RSVPOptionText}>{t(humanResponse(myEventResponse))} |</Text>
        <Icon name='ArrowDown' color={white} style={styles.RSVPOptionText} />
      </View>
    </PopupMenuButton>
  )
}

export function PostTitle ({ title, style }) {
  return <Text style={[styles.title, style]}>{decode(title)}</Text>
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 0
  },
  resourceEndsAt: {
    marginTop: 6,
    marginBottom: 6,
    color: white20onCaribbeanGreen,
    fontSize: 10,
    textTransform: 'uppercase'
  },
  title: {
    color: rhino,
    fontSize: 19,
    fontFamily: 'Circular-Medium',
    marginBottom: 8,
    flex: 1
  },
  details: {
    color: '#5D757A',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: 'Circular-Book'
  },
  RSVPOption: {
    backgroundColor: caribbeanGreen,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  RSVPOptionText: {
    color: white,
    fontSize: 12
  },
  RSVPOptionIcon: {
    fontSize: 14,
    marginTop: 1
  }
})
