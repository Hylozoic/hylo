exports.en = {
  apiInviteMessageContent: (name) => `${name} is excited to invite you to join our community on Hylo.`,
  apiInviteMessageSubject: (name) => `Join me in ${name} on Hylo!`,
  clientInviteSubjectDefault: (name) => `You've been invited to join ${name} on Hylo`,
  clientInviteMessageDefault: ({ userName, groupName }) => `Hi ${userName}, <br><br> We're excited to welcome you into our community. Click below to join ${groupName} on Hylo.`,
  CreatorEmail: () => 'Creator Email',
  createInvitationSubject: (name) => `Join me in ${name} on Hylo!`,
  CreatorName: () => 'Creator Name',
  CreatorURL: () => 'Creator URL',
  Group: () => 'Group',
  emailDigestDailySubject: (name) => `Your ${name} Daily Digest`,
  emailDigestWeeklySubject: (name) => `Your ${name} Weekly Digest`,
  groupCreatedNotifySubject: (name) => `New Hylo Group Created: ${name}`,
  moderationClearedFlagFromYourPost: () => 'Moderator cleared a flag from your post',
  moderationClearedPostEmailContent: ({ post, group }) => `Your post "${post.summary()}" in group ${group.get('name')} was cleared of a group agreement violation. \n`,
  moderationClearedYourFlag: () => 'Moderator cleared your flag',
  moderationFlaggedPostEmailContent: ({ post, group }) => `Your post "${post.summary()}" in group ${group.get('name')} was flagged as violating a group agreement. \n`,
  moderationReporterClearedPostEmailContent: ({ post, group }) => `The post "${post.summary()}" in group ${group.get('name')} that you flagged was cleared of a group agreement violation. \n`,
  moderationYouFlaggedAPost: () => 'You flagged a post',
  moderationYouFlaggedPostEmailContent: ({ post, group }) => `You flagged post "${post.summary()}" in group ${group.get('name')} as violating a group agreement. \n`,
  moderationYourPostWasFlagged: () => 'Your post was flagged',
  Name: () => 'Name',
  newSavedSearchResults: (name) => `New saved search results in ${name}`,
  textForApprovedJoinRequest: ({ actor, groupName }) => `${actor.get('name')} approved your request to join ${groupName}`,
  textForAnnouncement: ({ person, postName, groupName }) => `${person} sent an announcement "${postName}" to ${groupName}`,
  textForChatPost: ({ firstTag, groupName, person, postName }) => `${person} chatted "${postName}" in ${groupName}${firstTag ? ` #${firstTag}` : ''}`,
  textForCommentImage: person => `${person} sent an image`,
  textForCommentMention: ({ person, blurb, postName }) => `${person} mentioned you: "${blurb}" (in "${postName}")`,
  textForComment: ({ person, blurb, postName }) => `${person}: "${blurb}" (in "${postName}")`,
  textForContribution: post => `You have been added as a contributor to the request "${post.summary()}"`,
  textForDonationTo: ({ amount, postName }) => `You contributed $${amount} to "${postName}"`,
  textForDonationFrom: ({ amount, actor, postName }) => `${actor.get('name')} contributed $${amount} to "${postName}"`,
  textForEventInvitation: ({ actor, postName }) => `${actor.get('name')} invited you to "${postName}"`,
  textForGroupInvitation: ({ actor, groupName }) => `${actor.get('name')} invited you to join ${groupName}`,
  textForGroupInvitationAccepted: ({ actor, groupName }) => `${actor.get('name')} accepted your invitation to join ${groupName}`,
  textForGroupChildGroupInvite: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} invited your group ${childGroup.name} to join their group ${parentGroup.name}`,
  textForGroupChildGroupInviteAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} accepted your invite of their group ${childGroup.name} to join your group ${parentGroup.name}`,
  textForGroupChildGroupInviteAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} accepted your invite of your group ${childGroup.name} to join their group ${parentGroup.name}`,
  textForGroupChildGroupInviteAcceptedParentMember: ({ parentGroup, childGroup }) => `The group ${childGroup.name} just joined your group ${parentGroup.name}!`,
  textForGroupChildGroupInviteAcceptedChildMember: ({ parentGroup, childGroup }) => `Your group ${childGroup.name} has joined ${parentGroup.name}. You can now join ${parentGroup.name}!`,
  textForGroupParentGroupJoinRequest: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} is requesting to add their group ${childGroup.name} as a member of your group ${parentGroup.name}`,
  textForGroupParentGroupJoinRequestAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} accepted a request to add ${childGroup.name} to your group ${parentGroup.name}`,
  textForGroupParentGroupJoinRequestAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `Your group ${childGroup.name} has been accepted as a member of ${parentGroup.name} by ${actor.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedParentMember: ({ parentGroup, childGroup }) => `The group ${childGroup.name} just joined your group ${parentGroup.name}!`,
  textForGroupParentGroupJoinRequestAcceptedChildMember: ({ parentGroup, childGroup }) => `Your group ${childGroup.name} has joined ${parentGroup.name}.`,
  textForJoinRequest: ({ actor, groupName }) => `${actor.get('name')} asked to join ${groupName}`,
  textForMemberJoinedGroup: ({ group, actor }) => `New member has joined ${group.get('name')}: ${actor.get('name')}`,
  textForPostMention: ({ groupName, person, postName }) => `${person} mentioned you in post "${postName}" in ${groupName}`,
  textForPost: ({ firstTag, groupName, person, postName }) => `${person} posted "${postName}" in ${groupName}${firstTag ? ` #${firstTag}` : ''}`,
  textForVoteReset: ({ person, postName, groupName }) => `${person} changed the options for proposal: "${postName}" in ${groupName}. This has reset the votes`
}
