/**
 * Shared layout for the primary content column so loading skeletons match loaded UI.
 *
 * Stream: `stream-inner-container` uses max-w-[750px] + p-1 sm:p-4 (non-calendar).
 * ChatRoom: message list uses max-w-[750px] on empty state; Virtuoso uses px-1 sm:px-2.
 */

/** Same as Stream inner column (feed, topics, most group views). */
export const STREAM_MAIN_COLUMN_CLASS =
  'w-full max-w-[750px] mx-auto p-1 sm:p-4'

/**
 * Chat message list column (matches Virtuoso `className='px-3 sm:px-5'` + `max-w-[750px]`,
 * left-aligned). Vertical padding kept light so the list area matches `#chats`.
 */
export const CHAT_MESSAGE_COLUMN_CLASS =
  'w-full max-w-[750px] px-3 sm:px-5 py-1'
