import presentCollection from 'store/presenters/presentCollection'
import presentTopic from 'store/presenters/presentTopic'

export default function GroupPresenter (group) {
  if (!group) return null

  return {
    ...group,
    activeProjects: group.activeProjects || [],
    agreements: group?.agreements?.items ? group.agreements.items.sort((a, b) => a.order - b.order) : [],
    announcements: group.announcements
      ? group.announcements.map(a => ({
        ...a,
        author: a.creator.name,
        primaryImage: a.attachments.length > 0 ? a.attachments[0].url : false
      }))
      : [],
    customViews: group.customViews
      ? group.customViews.map(cv => ({
        ...cv,
        collection: cv.collection ? presentCollection(cv.collection) : null,
        topics: cv.topics.map(topic => presentTopic(topic, {}))
      }))
      : [],
    groupToGroupJoinQuestions: group.groupToGroupJoinQuestions ? group.groupToGroupJoinQuestions.toRefArray() : [],
    groupTopics: group.groupTopics
      ? group.groupTopics.map(groupTopic => ({ ...groupTopic, name: groupTopic.topic.name }))
      : [],
    joinQuestions: group.joinQuestions ? group.joinQuestions.toRefArray() : [],
    members: group.members ? group.members : [],
    stewards: group.stewards ? group.stewards : [],
    openOffersAndRequests: group.openOffersAndRequests || [],
    prerequisiteGroups: group.prerequisiteGroups
      ? group.prerequisiteGroups.map(prereq => ({ ...prereq, joinQuestions: prereq.joinQuestions || [] }))
      : [],
    suggestedSkills: group.suggestedSkills || [],
    upcomingEvents: group.upcomingEvents
      ? group.upcomingEvents.map(p => ({ ...p, primaryImage: p.attachments.length > 0 ? p.attachments[0].url : false }))
      : [],
    widgets: group.widgets || []
  }
}
