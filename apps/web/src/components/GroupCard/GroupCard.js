import { cn } from 'util/index'
import React from 'react'
import { Link } from 'react-router-dom'
import { TextHelpers } from '@hylo/shared'
import { groupUrl, groupDetailUrl } from 'util/navigation'
import ClickCatcher from 'components/ClickCatcher'
import useRouteParams from 'hooks/useRouteParams'
import GroupHeader from './GroupHeader'
import HyloHTML from 'components/HyloHTML'

import classes from './GroupCard.module.scss'

/*
  Each card needs
  - group title
  - group icon
  - group background (tiny, behind the group icon)
  - member sample (for avatars on right )
  - group geography descriptor (indigenous territory, location)

  TODO: Then is contents changed based on group type... perhaps passed in as a Content component
*/

export default function GroupCard ({
  memberships,
  group = {},
  highlightProps = {},
  className,
  expanded = false,
  constrained = false,
  onClick = () => {}
}) {
  // XXX: turning this off for now because topics are random and can be weird. Turn back on when groups have their own #tags
  // const topics = group.groupTopics && group.groupTopics.toModelArray()

  const routeParams = useRouteParams()

  const linkTo = memberships.includes(group.id)
    ? groupUrl(group.slug)
    : groupDetailUrl(group.slug, routeParams)

  return (
    <Link to={linkTo} className={classes.groupLink}>
      <div
        onClick={onClick}
        data-testid='group-card'
        className={cn(classes.card, { [classes.expanded]: expanded, [classes.constrained]: constrained }, className)}
      >
        <GroupHeader
          {...group}
          group={group}
          routeParams={routeParams}
          highlightProps={highlightProps}
          constrained={constrained}
        />
        {group.description && (
          <div className={classes.groupDescription}>
            <ClickCatcher>
              <HyloHTML element='span' html={TextHelpers.markdown(group.description)} />
            </ClickCatcher>
          </div>
        )}

        {/* XXX: turning this off for now because topics are random and can be weird. Turn back on when groups have their own #tags
         {topics.length > 0
           ? <div className={classes.groupTags}>
             {topics.map((topic, index) => (
               <Pill
                 className={classes.tagPill}
                 darkText
                 label={capitalize(topic.topic.name.toLowerCase())}
                 id={topic.id}
                 key={index}
               />
             ))}
           </div>
           : ''
         } */}
      </div>
    </Link>
  )
}
