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
  textForGroupChildGroupInvite: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} invited your group ${childGroup.get('name')} to join their group ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} accepted your invite of their group ${childGroup.get('name')} to join your group ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} accepted your invite of your group ${childGroup.get('name')} to join their group ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedParentMember: ({ parentGroup, childGroup }) => `The group ${childGroup.get('name')} just joined your group ${parentGroup.get('name')}!`,
  textForGroupChildGroupInviteAcceptedChildMember: ({ parentGroup, childGroup }) => `Your group ${childGroup.get('name')} has joined ${parentGroup.get('name')}. You can now join ${parentGroup.get('name')}!`,
  textForGroupParentGroupJoinRequest: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} is requesting to add their group ${childGroup.get('name')} as a member of your group ${parentGroup.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} accepted a request to add ${childGroup.get('name')} to your group ${parentGroup.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `Your group ${childGroup.get('name')} has been accepted as a member of ${parentGroup.get('name')} by ${actor.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedParentMember: ({ parentGroup, childGroup }) => `The group ${childGroup.get('name')} just joined your group ${parentGroup.get('name')}!`,
  textForGroupParentGroupJoinRequestAcceptedChildMember: ({ parentGroup, childGroup }) => `Your group ${childGroup.get('name')} has joined ${parentGroup.get('name')}.`,
  textForEventInvitation: ({ actor, postName }) => `${actor.get('name')} invited you to "${postName}"`,
  textForGroupInvitation: ({ actor, groupName }) => `${actor.get('name')} invited you to join ${groupName}`,
  textForGroupInvitationAccepted: ({ actor, groupName }) => `${actor.get('name')} accepted your invitation to join ${groupName}`,
  textForGroupPeerGroupInvite: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} invited your group ${toGroup.get('name')} to form a peer relationship with ${fromGroup.get('name')}`,
  textForGroupPeerGroupInviteAccepted: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} accepted the peer relationship between ${fromGroup.get('name')} and ${toGroup.get('name')}`,
  groupPeerGroupInviteSubject: ({ fromGroup, toGroup }) => `${fromGroup.get('name')} wants to form a peer relationship with ${toGroup.get('name')}`,
  groupPeerGroupInviteBody: ({ actor, fromGroup, toGroup, fromGroupUrl, toGroupSettingsUrl, emailSettingsUrl, inviterProfileUrl }) => `Hi there,

${actor.get('name')} from ${fromGroup.get('name')} has invited your group ${toGroup.get('name')} to form a peer relationship.

This means the groups would be connected as peers, allowing moderators to collaborate and coordinate activities.

View ${fromGroup.get('name')}: ${fromGroupUrl}
Manage group relationship invitations: ${toGroupSettingsUrl}
View ${actor.get('name')}'s profile: ${inviterProfileUrl}

Email notification settings: ${emailSettingsUrl}`,
  groupPeerGroupInviteAcceptedSubject: ({ fromGroup, toGroup }) => `Peer relationship established between ${fromGroup.get('name')} and ${toGroup.get('name')}`,
  groupPeerGroupInviteAcceptedBody: ({ actor, fromGroup, toGroup, fromGroupUrl, toGroupUrl, emailSettingsUrl, accepterProfileUrl }) => `Hi there,

${actor.get('name')} has accepted the peer relationship between ${fromGroup.get('name')} and ${toGroup.get('name')}.

Your groups are now connected as peers, enabling moderator collaboration and coordination.

View ${fromGroup.get('name')}: ${fromGroupUrl}
View ${toGroup.get('name')}: ${toGroupUrl}
View ${actor.get('name')}'s profile: ${accepterProfileUrl}

Email notification settings: ${emailSettingsUrl}`,
  textForJoinRequest: ({ actor, groupName }) => `${actor.get('name')} asked to join ${groupName}`,
  textForMemberJoinedGroup: ({ group, actor }) => `New member has joined ${group.get('name')}: ${actor.get('name')}`,
  textForPostMention: ({ groupName, person, postName }) => `${person} mentioned you in post "${postName}" in ${groupName}`,
  textForPost: ({ firstTag, groupName, person, postName }) => `${person} posted "${postName}" in ${groupName}${firstTag ? ` #${firstTag}` : ''}`,
  textForTrackCompleted: ({ actor, track }) => `Track completed: "${track.get('name')}" was completed by ${actor.get('name')}`,
  textForTrackEnrollment: ({ actor, track }) => `Track enrollment: "${track.get('name')}" was enrolled in by ${actor.get('name')}`,
  textForVoteReset: ({ person, postName, groupName }) => `${person} changed the options for proposal: "${postName}" in ${groupName}. This has reset the votes`,
  theTeamAtHylo: 'The Team at Hylo'
}
