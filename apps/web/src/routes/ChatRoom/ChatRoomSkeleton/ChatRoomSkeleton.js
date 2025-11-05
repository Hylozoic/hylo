import React from 'react'
import { cn } from 'util/index'
import styles from './ChatRoomSkeleton.module.scss'

/**
 * Skeleton loading UI for ChatRoom
 * Shows while initial data is loading to improve perceived performance
 */

export const ChatPostSkeleton = ({ showHeader = true, className }) => {
  return (
    <div className={cn('rounded-lg pr-[15px] pb-[1px] mb-1', className)}>
      {showHeader && (
        <div className='flex justify-between items-center mb-2'>
          <div className='flex items-center gap-2'>
            {/* Avatar skeleton */}
            <div className={cn('w-10 h-10 rounded-full', styles.skeleton)} />
            {/* Name skeleton */}
            <div className={cn('h-4 w-32 rounded', styles.skeleton)} />
          </div>
          {/* Timestamp skeleton */}
          <div className={cn('h-3 w-16 rounded', styles.skeleton)} />
        </div>
      )}

      {/* Post content skeleton - random widths for natural look */}
      <div className='space-y-2 ml-0 sm:ml-12'>
        <div className={cn('h-4 w-full rounded', styles.skeleton)} />
        <div className={cn('h-4 w-5/6 rounded', styles.skeleton)} />
      </div>
    </div>
  )
}

export const ChatRoomSkeleton = ({ count = 8 }) => {
  return (
    <div className='mx-auto max-w-[750px] p-4 space-y-4'>
      {Array.from({ length: count }).map((_, index) => {
        // Vary which messages show headers for natural look
        // Show header every 3-5 messages (simulating grouped messages)
        const showHeader = index === 0 || index % 4 === 0

        return (
          <ChatPostSkeleton
            key={index}
            showHeader={showHeader}
            className={showHeader ? 'mt-6' : 'mt-1'}
          />
        )
      })}
    </div>
  )
}

export default ChatRoomSkeleton
