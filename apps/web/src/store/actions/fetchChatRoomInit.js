import fetchTopicFollow from './fetchTopicFollow'

export default function fetchChatRoomInit ({
  groupId,
  topicName
}) {
  // Simple wrapper around fetchTopicFollow for consistency
  // Posts will be fetched by ChatRoom useEffect after topicFollow loads
  return fetchTopicFollow(groupId, topicName)
}
