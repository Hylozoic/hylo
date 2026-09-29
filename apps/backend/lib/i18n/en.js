exports.en = {
  apiInviteMessageContent: (name) => `${name} is excited to invite you to join our community on Hylo.`,
  apiInviteMessageSubject: (name) => `Join me in ${name} on Hylo!`,
  clientInviteSubjectDefault: (name) => `You've been invited to join ${name} on Hylo`,
  clientInviteMessageDefault: ({ userName, groupName }) => `Hi ${userName}, <br><br> We're excited to welcome you into our community. Click below to join ${groupName} on Hylo.`,
  commentDigestMentionedIn: () => 'You were mentioned in',
  commentDigestNewCommentsOn: () => 'New comments on',
  CreatorEmail: () => 'Creator Email',
  createInvitationSubject: (name) => `Join me in ${name} on Hylo!`,
  createInvitationMessage: (name) => `Hi!\n\nI'm inviting you to join ${name} on Hylo.\n\n${name} is using Hylo for our online community: this is our dedicated space for communication & collaboration.`,
  invitationOptOutTitle: () => 'Stop invitations',
  invitationOptOutQuestion: (email) => `Stop invitations to ${email}?`,
  invitationOptOutExplanation: () => 'Nobody will be able to invite this address to a group on Hylo.',
  invitationOptOutButton: () => 'Stop invitations',
  invitationOptOutDone: (email) => `Done. ${email} won't get any more invitations from Hylo.`,
  invitationOptOutNotFound: () => "This link doesn't work anymore.",
  invitationOptOutError: () => 'Something went wrong. Please try again.',
  CreatorName: () => 'Creator Name',
  CreatorURL: () => 'Creator URL',
  Group: () => 'Group',
  emailDigestDailySubject: (name) => `Your ${name} Daily Digest`,
  emailDigestWeeklySubject: (name) => `Your ${name} Weekly Digest`,
  emailDigestUnifiedDailySubject: () => 'Your Hylo Daily Digest',
  emailDigestUnifiedWeeklySubject: () => 'Your Hylo Weekly Digest',
  emailSenderViaHyloSuffix: () => ' (via Hylo)',
  groupCreatedNotifySubject: (name) => `New Hylo Group Created: ${name}`,
  fundingRoundTransitionButtonText: ({ phase }) => {
    const buttonTextMessages = {
      submissions: 'Add your submission',
      discussion: 'Discuss the submissions',
      voting: 'Vote in the round',
      completed: 'View the results',
      viewRound: 'View the Round'
    }
    return buttonTextMessages[phase] || 'View the round'
  },
  fundingRoundTransitionText: ({ phase }) => {
    const transitionTextMessages = {
      submissions: 'Submissions are now open',
      discussion: 'Submissions are now closed',
      voting: 'Voting is now open',
      completed: 'Voting is now closed'
    }
    return transitionTextMessages[phase] || 'Status updated'
  },
  moderationClearedFlagFromYourPost: () => 'Moderator cleared a flag from your post',
  moderationClearedPostEmailContent: ({ post, group }) => `Your post "${post.summary()}" in group ${group.get('name')} was cleared of a group agreement violation. \n`,
  moderationClearedYourFlag: () => 'Moderator cleared your flag',
  moderationFlaggedPostEmailContent: ({ post, group }) => `Your post "${post.summary()}" in group ${group.get('name')} was flagged as violating a group agreement. \n`,
  moderationReporterClearedPostEmailContent: ({ post, group }) => `The post "${post.summary()}" in group ${group.get('name')} that you flagged was cleared of a group agreement violation. \n`,
  moderationYouFlaggedAPost: () => 'You flagged a post',
  rsvpGoing: () => 'Going to',
  rsvpInterested: () => 'Interested in',
  rsvpNotGoing: () => 'Not Going to',
  moderationYouFlaggedPostEmailContent: ({ post, group }) => `You flagged post "${post.summary()}" in group ${group.get('name')} as violating a group agreement. \n`,
  moderationYourPostWasFlagged: () => 'Your post was flagged',
  moderationYouFlaggedAComment: () => 'You flagged a comment',
  moderationYourCommentWasFlagged: () => 'Your comment was flagged',
  moderationClearedFlagFromYourComment: () => 'Moderator cleared a flag from your comment',
  moderationYouFlaggedCommentEmailContent: ({ summary, group }) => `You flagged the comment "${summary}" in group ${group.get('name')} as violating a group agreement. \n`,
  moderationFlaggedCommentEmailContent: ({ summary, group }) => `Your comment "${summary}" in group ${group.get('name')} was flagged as violating a group agreement. \n`,
  moderationClearedCommentEmailContent: ({ summary, group }) => `Your comment "${summary}" in group ${group.get('name')} was cleared of a group agreement violation. \n`,
  moderationReporterClearedCommentEmailContent: ({ summary, group }) => `The comment "${summary}" in group ${group.get('name')} that you flagged was cleared of a group agreement violation. \n`,
  moderationPostClosedEmailSubject: () => 'Your post was closed',
  moderationPostReopenedEmailSubject: () => 'Your post was reopened',
  moderationPostClosedEmailContent: ({ post, group, actor }) => `${actor.get('name')} closed your post "${post.summary()}" in group ${group.get('name')}. \n`,
  moderationPostReopenedEmailContent: ({ post, group, actor }) => `${actor.get('name')} reopened your post "${post.summary()}" in group ${group.get('name')}. \n`,
  Name: () => 'Name',
  newSavedSearchResults: (name) => `New saved search results in ${name}`,
  textForApprovedJoinRequest: ({ actor, groupName }) => `${actor.get('name')} approved your request to join ${groupName}`,
  textForAnnouncement: ({ person, postName }) => `Announcement from ${person}: ${postName}`,
  textForChatPost: ({ firstTag, person, postName }) => `${person}: ${postName}${firstTag ? ` #${firstTag}` : ''}`,
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
  textForGroupInvitation: ({ actor, groupName, parentGroupName }) => parentGroupName
    ? `${actor.get('name')} has invited you to join them in space ${groupName} in ${parentGroupName}`
    : `${actor.get('name')} has invited you to join them in ${groupName}`,
  textForGroupInvitationAccepted: ({ actor, groupName }) => `${actor.get('name')} accepted your invitation to join ${groupName}`,
  textForGroupPeerGroupInvite: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} invited your group ${toGroup.get('name')} to form a peer relationship with ${fromGroup.get('name')}`,
  textForGroupPeerGroupInviteAccepted: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} accepted the peer relationship between ${fromGroup.get('name')} and ${toGroup.get('name')}`,
  textForJoinRequest: ({ actor, groupName, parentGroupName }) => parentGroupName
    ? `${actor.get('name')} asked to join ${groupName} in ${parentGroupName}`
    : `${actor.get('name')} asked to join ${groupName}`,
  textForMemberJoinedGroup: ({ group, actor }) => `New member has joined ${group.get('name')}: ${actor.get('name')}`,
  joinRequestReceivedSubject: (groupName) => `Your request to join ${groupName} was sent`,
  joinRequestDeclinedSubject: (groupName) => `About your request to join ${groupName}`,
  joinRequestUnansweredSubject: (groupName) => `Your request to join ${groupName} is still waiting`,
  roleGrantedSubject: ({ roleName, groupName }) => `You have a new role in ${groupName}: ${roleName}`,
  stewardWeeklySubject: (groupName) => `This week in ${groupName}, for stewards`,
  textForPostModeratedFulfillment: ({ post, actor, reason }) => {
    const postName = post.summary()
    if (reason === 'postUnfulfilled') {
      return `${actor.get('name')} reopened your post "${postName}"`
    }
    return `${actor.get('name')} closed your post "${postName}"`
  },
  textForPostMention: ({ person, postName }) => `${person} mentioned you: ${postName}`,
  textForPost: ({ firstTag, person, postName }) => `${person}: ${postName}${firstTag ? ` #${firstTag}` : ''}`,
  textForTrackCompleted: ({ actor, trackName }) => `Track completed: "${trackName}" was completed by ${actor.get('name')}`,
  textForTrackEnrollment: ({ actor, trackName }) => `Track enrollment: "${trackName}" was enrolled in by ${actor.get('name')}`,
  textForVoteReset: ({ person, postName, groupName }) => `${person} changed the options for proposal: "${postName}" in ${groupName}. This has reset the votes`,
  textForFundingRoundNewSubmission: ({ fundingRoundTitle, post, actor }) => `${actor.get('name')} submitted "${post.summary()}" to "${fundingRoundTitle}"`,
  textForFundingRoundPhaseTransition: ({ fundingRoundTitle, phase }) => {
    const phaseMessages = {
      submissions: 'Submissions are now open',
      discussion: 'Submissions have closed and discussions are open',
      voting: 'Voting is now open',
      completed: 'Voting has closed and the round has ended'
    }
    return `${fundingRoundTitle}: ${phaseMessages[phase] || 'Status updated'}`
  },
  textForFundingRoundReminder: ({ reminderType }) => {
    const reminderMessages = {
      submissionsClosing1Day: 'Submissions close in 1 day',
      submissionsClosing3Days: 'Submissions close in 3 days',
      votingClosing1Day: 'Voting closes in 1 day',
      votingClosing3Days: 'Voting closes in 3 days'
    }
    return `${reminderMessages[reminderType] || 'Deadline approaching'}`
  },
  theTeamAtHylo: 'The Team at Hylo',
  stripeContributionProductName: () => 'Choose Your Hylo Contribution',
  stripeContributionProductDescription: () => 'Choose your level of contribution to support the Hylo platform.',
  stripeSlidingScaleUnitProductName: ({ currency }) => `Set Your Contribution Amount (${currency} units)`,
  stripeSlidingScaleUnitProductDescription: () => 'Adjust quantity to choose your contribution amount.',
  donationTaxReceiptInfo: () => '',
  donationImpactMessage: () => 'Your contribution helps support the Hylo platform and our mission to enable better coordination and collaboration in communities worldwide.',
  donationRecurringImpactMessage: () => 'Your recurring contribution helps support the Hylo platform and our mission to enable better coordination and collaboration in communities worldwide.'
}
