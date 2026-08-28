export const CHAT_TOUR_ID = 'chat-room'

/** First time in a chat room. */
export function chatTourSteps (t) {
  return [
    {
      element: '[data-tour="chat-composer"]',
      popover: {
        title: t('Chat in real time'),
        description: t('Messages post instantly. Attach files with + and toggle formatting with Aa.'),
        side: 'top'
      }
    },
    {
      element: '[data-tour="chat-members"]',
      popover: {
        title: t("Who's here"),
        description: t('The green dot means someone is online right now; people typing pulse to the front.'),
        side: 'left'
      }
    },
    {
      element: '[data-tour="chat-pins"]',
      popover: {
        title: t('Pinned posts'),
        description: t('Up to three pinned posts stay at the top of the room.'),
        side: 'bottom'
      }
    },
    {
      element: '[data-tour="chat-width-rail"]',
      popover: {
        title: t('Adjust the width'),
        description: t('Drag this edge to make the chat column wider or narrower.'),
        side: 'right'
      }
    }
  ]
}
