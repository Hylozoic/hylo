exports.de = {
  apiInviteMessageContent: (name) => `${name} lädt Sie ein, unserer Community auf Hylo beizutreten.`,
  apiInviteMessageSubject: (name) => `Komm zu mir in ${name} auf Hylo!`,
  clientInviteSubjectDefault: (name) => `Du wurdest eingeladen, ${name} auf Hylo beizutreten`,
  clientInviteMessageDefault: ({ userName, groupName }) => `Hallo ${userName}, <br><br> wir freuen uns, dich in unserer Community willkommen zu heißen. Klicke unten, um ${groupName} auf Hylo beizutreten.`,
  CreatorEmail: () => 'E-Mail der Person, die die Gruppe erstellt hat',
  createInvitationSubject: (name) => `Komm zu mir in ${name} auf Hylo!`,
  CreatorName: () => 'Name der Person, die die Gruppe erstellt hat',
  CreatorURL: () => 'URL der Person, die die Gruppe erstellt hat',
  Group: () => 'Gruppe',
  emailDigestDailySubject: (name) => `Dein täglicher Überblick für ${name}`,
  emailDigestWeeklySubject: (name) => `Dein wöchentlicher Überblick für ${name}`,
  groupCreatedNotifySubject: (name) => `Neue Hylo-Gruppe erstellt: ${name}`,
  fundingRoundTransitionButtonText: ({ phase }) => {
    const buttonTextMessages = {
      submissions: 'Beitrag einreichen',
      discussion: 'Beiträge besprechen',
      voting: 'In der Runde abstimmen',
      completed: 'Ergebnisse ansehen',
      viewRound: 'Runde ansehen'
    }
    return buttonTextMessages[phase] || 'Runde ansehen'
  },
  fundingRoundTransitionText: ({ phase }) => {
    const transitionTextMessages = {
      submissions: 'Einreichungen sind jetzt offen',
      discussion: 'Einreichungen sind jetzt geschlossen',
      voting: 'Abstimmung ist jetzt offen',
      completed: 'Abstimmung ist jetzt geschlossen'
    }
    return transitionTextMessages[phase] || 'Status aktualisiert'
  },
  moderationClearedFlagFromYourPost: () => 'Moderation hat eine Meldung zu deinem Beitrag aufgehoben',
  moderationClearedPostEmailContent: ({ post, group }) => `Dein Beitrag „${post.summary()}“ in der Gruppe ${group.get('name')} wurde von einem Verstoß gegen eine Gruppenvereinbarung freigestellt. \n`,
  moderationClearedYourFlag: () => 'Moderation hat deine Meldung aufgehoben',
  moderationFlaggedPostEmailContent: ({ post, group }) => `Dein Beitrag „${post.summary()}“ in der Gruppe ${group.get('name')} wurde als Verstoß gegen eine Gruppenvereinbarung gemeldet. \n`,
  moderationReporterClearedPostEmailContent: ({ post, group }) => `Der Beitrag „${post.summary()}“ in der Gruppe ${group.get('name')}, den du gemeldet hast, wurde von einem Verstoß gegen eine Gruppenvereinbarung freigestellt. \n`,
  moderationYouFlaggedAPost: () => 'Du hast einen Beitrag gemeldet',
  moderationYouFlaggedPostEmailContent: ({ post, group }) => `Du hast den Beitrag „${post.summary()}“ in der Gruppe ${group.get('name')} als Verstoß gegen eine Gruppenvereinbarung gemeldet. \n`,
  moderationYourPostWasFlagged: () => 'Dein Beitrag wurde gemeldet',
  Name: () => 'Name',
  newSavedSearchResults: (name) => `Neue Ergebnisse für die gespeicherte Suche in ${name}`,
  textForApprovedJoinRequest: ({ actor, groupName }) => `${actor.get('name')} hat deine Anfrage angenommen, ${groupName} beizutreten`,
  textForAnnouncement: ({ person, postName, groupName }) => `${person} hat eine Ankündigung „${postName}“ an ${groupName} gesendet`,
  textForChatPost: ({ firstTag, groupName, person, postName }) => `${person} hat im Chat „${postName}“ in ${groupName} geschrieben${firstTag ? ` #${firstTag}` : ''}`,
  textForCommentImage: person => `${person} hat ein Bild gesendet`,
  textForCommentMention: ({ person, blurb, postName }) => `${person} hat dich erwähnt: „${blurb}“ (in „${postName}“)`,
  textForComment: ({ person, blurb, postName }) => `${person}: „${blurb}“ (in „${postName}“)`,
  textForContribution: post => `Du wurdest als Mitwirkende:r zur Anfrage „${post.summary()}“ hinzugefügt`,
  textForDonationTo: ({ amount, postName }) => `Du hast ${amount} $ an „${postName}“ gespendet`,
  textForDonationFrom: ({ amount, actor, postName }) => `${actor.get('name')} hat ${amount} $ an „${postName}“ gespendet`,
  textForGroupChildGroupInvite: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} hat deine Gruppe ${childGroup.get('name')} eingeladen, der Gruppe ${parentGroup.get('name')} beizutreten`,
  textForGroupChildGroupInviteAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} hat deine Einladung angenommen, dass die Gruppe ${childGroup.get('name')} deiner Gruppe ${parentGroup.get('name')} beitritt`,
  textForGroupChildGroupInviteAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} hat deine Einladung angenommen, dass deine Gruppe ${childGroup.get('name')} der Gruppe ${parentGroup.get('name')} beitritt`,
  textForGroupChildGroupInviteAcceptedParentMember: ({ parentGroup, childGroup }) => `Die Gruppe ${childGroup.get('name')} ist deiner Gruppe ${parentGroup.get('name')} beigetreten!`,
  textForGroupChildGroupInviteAcceptedChildMember: ({ parentGroup, childGroup }) => `Deine Gruppe ${childGroup.get('name')} ist ${parentGroup.get('name')} beigetreten. Du kannst jetzt ${parentGroup.get('name')} beitreten!`,
  textForGroupParentGroupJoinRequest: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} möchte die Gruppe ${childGroup.get('name')} als Mitglied deiner Gruppe ${parentGroup.get('name')} hinzufügen`,
  textForGroupParentGroupJoinRequestAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} hat eine Anfrage angenommen, ${childGroup.get('name')} zu deiner Gruppe ${parentGroup.get('name')} hinzuzufügen`,
  textForGroupParentGroupJoinRequestAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `Deine Gruppe ${childGroup.get('name')} wurde von ${actor.get('name')} als Mitglied von ${parentGroup.get('name')} angenommen`,
  textForGroupParentGroupJoinRequestAcceptedParentMember: ({ parentGroup, childGroup }) => `Die Gruppe ${childGroup.get('name')} ist deiner Gruppe ${parentGroup.get('name')} beigetreten!`,
  textForGroupParentGroupJoinRequestAcceptedChildMember: ({ parentGroup, childGroup }) => `Deine Gruppe ${childGroup.get('name')} ist ${parentGroup.get('name')} beigetreten.`,
  textForEventInvitation: ({ actor, postName }) => `${actor.get('name')} hat dich zu „${postName}“ eingeladen`,
  textForGroupInvitation: ({ actor, groupName }) => `${actor.get('name')} hat dich eingeladen, ${groupName} beizutreten`,
  textForGroupInvitationAccepted: ({ actor, groupName }) => `${actor.get('name')} hat deine Einladung angenommen, ${groupName} beizutreten`,
  textForGroupPeerGroupInvite: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} hat deine Gruppe ${toGroup.get('name')} eingeladen, eine Peer-Beziehung mit ${fromGroup.get('name')} zu bilden`,
  textForGroupPeerGroupInviteAccepted: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} hat die Peer-Beziehung zwischen ${fromGroup.get('name')} und ${toGroup.get('name')} angenommen`,
  textForJoinRequest: ({ actor, groupName }) => `${actor.get('name')} möchte ${groupName} beitreten`,
  textForMemberJoinedGroup: ({ group, actor }) => `Neues Mitglied in ${group.get('name')}: ${actor.get('name')}`,
  textForPostMention: ({ groupName, person, postName }) => `${person} hat dich im Beitrag „${postName}“ in ${groupName} erwähnt`,
  textForPost: ({ firstTag, groupName, person, postName }) => `${person} hat „${postName}“ in ${groupName} veröffentlicht${firstTag ? ` #${firstTag}` : ''}`,
  textForTrackCompleted: ({ actor, track }) => `Lernpfad abgeschlossen: „${track.get('name')}“ von ${actor.get('name')} abgeschlossen`,
  textForTrackEnrollment: ({ actor, track }) => `Lernpfad-Teilnahme: „${track.get('name')}“ von ${actor.get('name')} begonnen`,
  textForVoteReset: ({ person, postName, groupName }) => `${person} hat die Optionen für den Vorschlag „${postName}“ in ${groupName} geändert. Die Stimmen wurden zurückgesetzt`,
  textForFundingRoundNewSubmission: ({ fundingRound, post, actor }) => `${actor.get('name')} hat „${post.summary()}“ für „${fundingRound.get('title')}“ eingereicht`,
  textForFundingRoundPhaseTransition: ({ fundingRound, phase }) => {
    const phaseMessages = {
      submissions: 'Einreichungen sind jetzt offen',
      discussion: 'Einreichungen sind geschlossen, Diskussionen sind offen',
      voting: 'Abstimmung ist jetzt offen',
      completed: 'Abstimmung ist geschlossen, die Runde ist beendet'
    }
    return `${fundingRound.get('title')}: ${phaseMessages[phase] || 'Status aktualisiert'}`
  },
  textForFundingRoundReminder: ({ reminderType }) => {
    const reminderMessages = {
      submissionsClosing1Day: 'Einreichungen schließen in 1 Tag',
      submissionsClosing3Days: 'Einreichungen schließen in 3 Tagen',
      votingClosing1Day: 'Abstimmung endet in 1 Tag',
      votingClosing3Days: 'Abstimmung endet in 3 Tagen'
    }
    return `${reminderMessages[reminderType] || 'Frist naht'}`
  },
  theTeamAtHylo: 'Das Hylo-Team',
  stripeContributionProductName: () => 'Wähle deinen Hylo-Beitrag',
  stripeContributionProductDescription: () => 'Wähle deine Beitragshöhe, um die Hylo-Plattform zu unterstützen.',
  stripeSlidingScaleUnitProductName: ({ currency }) => `Lege deinen Beitragsbetrag fest (${currency}-Einheiten)`,
  stripeSlidingScaleUnitProductDescription: () => 'Passe die Menge an, um deinen Beitragsbetrag zu wählen.',
  donationTaxReceiptInfo: () => '',
  donationImpactMessage: () => 'Dein Beitrag unterstützt die Hylo-Plattform und unsere Mission, bessere Koordination und Zusammenarbeit in Gemeinschaften weltweit zu ermöglichen.',
  donationRecurringImpactMessage: () => 'Dein wiederkehrender Beitrag unterstützt die Hylo-Plattform und unsere Mission, bessere Koordination und Zusammenarbeit in Gemeinschaften weltweit zu ermöglichen.'
}
