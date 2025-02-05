export function lastMessageCreator (message, currentUser, participants, t) {
  const creatorPersonId = message.creator?.id || message.creator

  if (creatorPersonId === currentUser.id) return t('You') + ': '
  if (participants.length <= 2) return ''

  const creator = participants.find(p => p.id === creatorPersonId)
  return (creator?.name || 'Unknown User') + ': '
}
