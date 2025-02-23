export default {
  AffiliationQuerySet: () => null,
  ActivityMeta: () => null,
  AgreementQuerySet: () => null,
  CommentQuerySet: () => null,
  ContextWidgetQuerySet: () => null,
  CustomViewQuerySet: () => null,
  EventInvitationQuerySet: () => null,
  GroupExistsOutput: () => null,
  GroupExtensionQuerySet: () => null,
  GroupJoinQuestionQuerySet: () => null,
  GroupQuerySet: () => null,
  GroupRole: () => null,
  GroupRoleQuerySet: () => null,
  // TODO: URQL! -- This is due to out-of-scheme return { groupTopics(autocomplete: $searchTerm, first: 20) { topic { ... } } }
  // in topicsForGroupIdQuery. May have adverse side-effects, and should be fixed in the backend to comply with scheme
  // or scheme updated.
  // Response: This is likely similar/same as what happens with search and updates Subscription
  // which return Union types. We are for now just leaving these warnings, as they seem to be causing
  // no harm, and I think are preferable to id'ing these results in terms of potential caching side-effects.
  GroupTopic: data => data?.id || data?.topic?.id,
  GroupWidgetQuerySet: () => null,
  GroupSettings: () => null,
  GroupTopicQuerySet: () => null,
  JoinRequestQuerySet: () => null,
  Location: () => null,
  Me: () => 'me',
  Membership: () => null,
  MembershipSettings: () => null,
  MembershipCommonRoleQuerySet: () => null,
  MembershipQuerySet: () => null,
  MessageQuerySet: () => null,
  MessageThreadQuerySet: () => null,
  ModerationAction: data => data?.id,
  ModerationActionQuerySet: () => null,
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
