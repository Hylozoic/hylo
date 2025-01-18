export default {
  AffiliationQuerySet: () => null,
  ActivityMeta: () => null,
  AgreementQuerySet: () => null,
  CommentQuerySet: () => null,
  CustomViewQuerySet: () => null,
  EventInvitationQuerySet: () => null,
  GroupExistsOutput: () => null,
  GroupExtensionQuerySet: () => null,
  GroupJoinQuestionQuerySet: () => null,
  GroupQuerySet: () => null,
  GroupRole: () => null,
  GroupRoleQuerySet: () => null,
  // This is due to out-of-scheme return { groupTopics(autocomplete: $searchTerm, first: 20) { topic { ... } } }
  // in topicsForGroupIdQuery. May have adverse side-effects, and should be fixed in the backend to comply with scheme
  // or scheme updated
  GroupTopic: data => data?.id || data?.topic?.id,
  GroupWidgetQuerySet: () => null,
  GroupSettings: () => null,
  GroupTopicQuerySet: () => null,
  JoinRequestQuerySet: () => null,
  Location: () => null,
  Membership: () => null,
  MembershipSettings: () => null,
  MembershipCommonRoleQuerySet: () => null,
  MembershipQuerySet: () => null,
  MessageQuerySet: () => null,
  MessageThreadQuerySet: () => null,
  NotificationQuerySet: () => null,
  PersonConnectionQuerySet: () => null,
  PersonQuerySet: () => null,
  Point: () => null,
  PostQuerySet: () => null,
  ProposalOptionQuerySet: () => null,
  ProposalVoteQuerySet: () => null,
  ResponsibilityQuerySet: () => null,
  SearchResultQuerySet: () => null,
  SkillQuerySet: () => null,
  UserSettings: () => null
}
