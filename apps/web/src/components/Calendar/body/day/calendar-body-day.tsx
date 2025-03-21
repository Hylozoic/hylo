import React from 'react'
import { cn } from 'util/index'
import useRouteParams from 'hooks/useRouteParams'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import CalendarBodyDayCalendar from './calendar-body-day-calendar'
import { useCalendarContext } from '../../calendar-context'
import { includes } from '@hylo/shared/src/DateTimeHelper'
import PostListRow from 'components/PostListRow'
import styles from 'routes/Stream/Stream.module.scss'

export default function CalendarBodyDay () {
  const { date, events, group } = useCalendarContext()
  const routeParams = useRouteParams()
  const querystringParams = getQuerystringParam(['s', 't', 'v', 'c', 'search', 'timeframe'], location)
  const dayEvents = events.filter((event) => includes(event.start, date, event.end))
  return (
    <div className='flex flex-grow p-0'>
      <div className='flex flex-col flex-grow'>
        {dayEvents.map(event => {
          const post = event.post
          return (
            <PostListRow
              className={cn({ [styles.cardItem]: false })}
              routeParams={routeParams}
              post={post}
              group={group}
              key={post.id}
              currentGroupId={group && group.id}
              querystringParams={querystringParams}
            />
          )
        })}
      </div>
      <div className='lg:flex hidden flex-col flex-grow divide-y max-w-[276px]'>
        <CalendarBodyDayCalendar />
      </div>
    </div>
  )
}
