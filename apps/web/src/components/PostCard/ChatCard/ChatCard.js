import { cn } from 'util/index'
import { DateTimeHelpers } from '@hylo/shared'
import { localeLocalStorageSync } from 'util/locale'
import React from 'react'
import CardFileAttachments from 'components/CardFileAttachments'
import CardImageAttachments from 'components/CardImageAttachments'
import ClickCatcher from 'components/ClickCatcher'
import Highlight from 'components/Highlight'
import HyloHTML from 'components/HyloHTML'
import RoundImage from 'components/RoundImage'

import classes from './ChatCard.module.scss'

export default function ChatCard ({
  expanded,
  highlightProps,
  post,
  showDetails,
  slug
}) {
  const firstTopic = post.topics[0]?.name
  const firstGroup = post.groups[0].name

  return (
    <span onClick={() => showDetails(post.id)} className={classes.link}>
      <div className={cn(classes.chatCard, { [classes.expanded]: expanded })}>
        <div className={classes.postHeader}>
          <RoundImage url={post.creator.avatarUrl} className={classes.profileImage} />
          <Highlight {...highlightProps}>
            <div className={classes.postMeta}>
              <span className={classes.personName}>{post.creator.name}</span> chatted in&nbsp;
              <span className={classes.postTopic}>#{firstTopic}</span>
              {!slug && <span>in&nbsp; <span className={classes.groupName}>{firstGroup}</span></span>}
            </div>
          </Highlight>
          <span className={classes.date}>{DateTimeHelpers.toDateTime(post.createdAt, { locale: localeLocalStorageSync() }).toFormat('yyyy t')}</span>
        </div>
        {post.attachments && post.attachments.length > 0 && (
          <>
            <CardImageAttachments attachments={post.attachments} linked className={classes.postImages} />
            <CardFileAttachments attachments={post.attachments} className={classes.postFiles} />
          </>
        )}
        <ClickCatcher groupSlug={slug}>
          <Highlight {...highlightProps}>
            <HyloHTML className={classes.postBody} html={post.details} />
          </Highlight>
        </ClickCatcher>
      </div>
    </span>
  )
}
