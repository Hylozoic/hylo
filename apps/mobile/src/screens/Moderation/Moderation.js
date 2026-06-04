// DEPRECATED: This native screen is no longer used.
// All functionality is now handled by PrimaryWebView displaying the web app.
// Kept for reference only.

import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import ModerationList from 'components/ModerationList'
import StreamHeader from '../Stream/StreamHeader'

export default function Moderation () {
  const ref = useRef(null)
  const { t } = useTranslation()
  const [{ currentGroup }] = useCurrentGroup()

  if (!currentGroup) return null

  return (
    <ModerationList
      scrollRef={ref}
      forGroup={currentGroup}
      header={(
        <StreamHeader
          image={currentGroup.bannerUrl ? { uri: currentGroup.bannerUrl } : null}
          name={t('Moderation')}
          currentGroup={currentGroup}
          streamType='moderation'
        />
      )}
      streamType='moderation'
    />
  )
}
