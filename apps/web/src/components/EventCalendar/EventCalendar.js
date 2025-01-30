'use client'

import { useState } from 'react'
import Calendar from '../Calendar/calendar'
import { DateTime } from 'luxon'

export default function EventCalendar({posts, routeParams, locationParams, querystringParams}) {
  if (posts.length === 0) return

  const [mode, setMode] = useState('month')
  const [date, setDate] = useState(new Date())

  // map posts objects to calendar objects
  // unique color per group
  const colors = ['blue', 'indigo', 'pink', 'red', 'orange', 'amber', 'emerald']
  let groupColor = {}
  let i = 0
  const events = posts.map((post) => {
    groupColor[post.group] ||= colors[i++ % colors.length]
    return {
      id: post.id,
      start: DateTime.fromISO(post.startTime).toJSDate(),
      end: DateTime.fromISO(post.endTime).toJSDate(),
      title: post.title,
      color: groupColor[post.group]
    }
  })

  return (
    <Calendar
      events={events}
      routeParams={routeParams}
      locationParams={locationParams}
      querystringParams={querystringParams}
      mode={mode}
      setMode={setMode}
      date={date}
      setDate={setDate}
    />
  )
}
