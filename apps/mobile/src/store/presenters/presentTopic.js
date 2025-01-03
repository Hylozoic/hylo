export default function presentTopic (topic) {
  if (!topic) return null

  return {
    ...topic,
    label: topic.name,
    value: topic.name,
    groupTopics: topic?.groupTopics?.items
  }
}
