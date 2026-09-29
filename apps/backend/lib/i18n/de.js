exports.de = {
  apiInviteMessageContent: (name) => `${name} lädt Sie ein, unserer Community auf Hylo beizutreten.`,
  apiInviteMessageSubject: (name) => `Komm zu mir in ${name} auf Hylo!`,
  clientInviteSubjectDefault: (name) => `Du wurdest eingeladen, ${name} auf Hylo beizutreten`,
  clientInviteMessageDefault: ({ userName, groupName }) => `Hallo ${userName}, <br><br> wir freuen uns, dich in unserer Community willkommen zu heißen. Klicke unten, um ${groupName} auf Hylo beizutreten.`,
  commentDigestMentionedIn: () => 'Du wurdest erwähnt in',
  commentDigestNewCommentsOn: () => 'Neue Kommentare zu',
  CreatorEmail: () => 'E-Mail der Person, die die Gruppe erstellt hat',
  createInvitationSubject: (name) => `Komm zu mir in ${name} auf Hylo!`,
  createInvitationMessage: (name) => `Hallo!\n\nIch lade dich ein, ${name} auf Hylo beizutreten.\n\n${name} nutzt Hylo für unsere Online-Community: Dies ist unser dedizierter Bereich für Kommunikation und Zusammenarbeit.`,
  invitationOptOutTitle: () => 'Einladungen stoppen',
  invitationOptOutQuestion: (email) => `Einladungen an ${email} stoppen?`,
  invitationOptOutExplanation: () => 'Niemand wird diese Adresse mehr in eine Gruppe auf Hylo einladen können.',
  invitationOptOutButton: () => 'Einladungen stoppen',
  invitationOptOutDone: (email) => `Erledigt. ${email} erhält keine Einladungen von Hylo mehr.`,
  invitationOptOutNotFound: () => 'Dieser Link funktioniert nicht mehr.',
  invitationOptOutError: () => 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
  CreatorName: () => 'Name der Person, die die Gruppe erstellt hat',
  CreatorURL: () => 'URL der Person, die die Gruppe erstellt hat',
  Group: () => 'Gruppe',
  emailDigestDailySubject: (name) => `Dein täglicher Überblick für ${name}`,
  emailDigestWeeklySubject: (name) => `Dein wöchentlicher Überblick für ${name}`,
  emailDigestUnifiedDailySubject: () => 'Dein täglicher Hylo-Überblick',
  emailDigestUnifiedWeeklySubject: () => 'Dein wöchentlicher Hylo-Überblick',
  // D9: in the first weekly digest after a daily digest was slowed down for being away
  emailDigestSlowedNotice: () => 'Solange du weg warst, haben wir deine E-Mails auf eine wöchentliche Zusammenfassung reduziert. Besuche Hylo jederzeit, dann bekommst du deine tägliche Zusammenfassung wieder.',
  emailDigestTopPostSubject: ({ title, count, groupName }) => count > 0 ? `${title} +${count} weitere in ${groupName}` : `${title} in ${groupName}`,
  emailDigestUnifiedTopPostSubject: ({ title, count }) => count > 0 ? `${title} +${count} weitere in deinen Gruppen` : title,
  emailDigestWeeklyMixupNotice: () => 'Entschuldige die Lücke: Bis August wurden wöchentliche Überblicke wie dieser versehentlich nur einmal im Monat verschickt. Das ist behoben, und ab jetzt bekommst du diesen Überblick jede Woche.',
  emailSenderViaHyloSuffix: () => ' (über Hylo)',
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
  rsvpGoing: () => 'dabei bei',
  rsvpInterested: () => 'interessiert an',
  rsvpNotGoing: () => 'nicht dabei bei',
  moderationYouFlaggedPostEmailContent: ({ post, group }) => `Du hast den Beitrag „${post.summary()}“ in der Gruppe ${group.get('name')} als Verstoß gegen eine Gruppenvereinbarung gemeldet. \n`,
  moderationYourPostWasFlagged: () => 'Dein Beitrag wurde gemeldet',
  moderationYouFlaggedAComment: () => 'Du hast einen Kommentar gemeldet',
  moderationYourCommentWasFlagged: () => 'Dein Kommentar wurde gemeldet',
  moderationClearedFlagFromYourComment: () => 'Moderation hat eine Meldung zu deinem Kommentar aufgehoben',
  moderationYouFlaggedCommentEmailContent: ({ summary, group }) => `Du hast den Kommentar „${summary}“ in der Gruppe ${group.get('name')} als Verstoß gegen eine Gruppenvereinbarung gemeldet. \n`,
  moderationFlaggedCommentEmailContent: ({ summary, group }) => `Dein Kommentar „${summary}“ in der Gruppe ${group.get('name')} wurde als Verstoß gegen eine Gruppenvereinbarung gemeldet. \n`,
  moderationClearedCommentEmailContent: ({ summary, group }) => `Dein Kommentar „${summary}“ in der Gruppe ${group.get('name')} wurde von einem Verstoß gegen eine Gruppenvereinbarung freigestellt. \n`,
  moderationReporterClearedCommentEmailContent: ({ summary, group }) => `Der Kommentar „${summary}“ in der Gruppe ${group.get('name')}, den du gemeldet hast, wurde von einem Verstoß gegen eine Gruppenvereinbarung freigestellt. \n`,
  moderationPostClosedEmailSubject: () => 'Dein Beitrag wurde geschlossen',
  moderationPostReopenedEmailSubject: () => 'Dein Beitrag wurde wieder geöffnet',
  moderationPostClosedEmailContent: ({ post, group, actor }) => `${actor.get('name')} hat deinen Beitrag „${post.summary()}“ in der Gruppe ${group.get('name')} geschlossen. \n`,
  moderationPostReopenedEmailContent: ({ post, group, actor }) => `${actor.get('name')} hat deinen Beitrag „${post.summary()}“ in der Gruppe ${group.get('name')} wieder geöffnet. \n`,
  Name: () => 'Name',
  newSavedSearchResults: (name) => `Neue Ergebnisse für die gespeicherte Suche in ${name}`,
  textForApprovedJoinRequest: ({ actor, groupName }) => `${actor.get('name')} hat deine Anfrage angenommen, ${groupName} beizutreten`,
  textForAnnouncement: ({ person, postName }) => `Ankündigung von ${person}: ${postName}`,
  textForChatPost: ({ firstTag, person, postName }) => `${person}: ${postName}${firstTag ? ` #${firstTag}` : ''}`,
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
  textForGroupInvitation: ({ actor, groupName, parentGroupName }) => parentGroupName
    ? `${actor.get('name')} hat dich eingeladen, ihnen im Space ${groupName} in ${parentGroupName} beizutreten`
    : `${actor.get('name')} hat dich eingeladen, ihnen in ${groupName} beizutreten`,
  textForGroupInvitationAccepted: ({ actor, groupName }) => `${actor.get('name')} hat deine Einladung angenommen, ${groupName} beizutreten`,
  textForGroupPeerGroupInvite: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} hat deine Gruppe ${toGroup.get('name')} eingeladen, eine Peer-Beziehung mit ${fromGroup.get('name')} zu bilden`,
  textForGroupPeerGroupInviteAccepted: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} hat die Peer-Beziehung zwischen ${fromGroup.get('name')} und ${toGroup.get('name')} angenommen`,
  textForJoinRequest: ({ actor, groupName, parentGroupName }) => parentGroupName
    ? `${actor.get('name')} möchte ${groupName} in ${parentGroupName} beitreten`
    : `${actor.get('name')} möchte ${groupName} beitreten`,
  textForMemberJoinedGroup: ({ group, actor }) => `Neues Mitglied in ${group.get('name')}: ${actor.get('name')}`,
  joinRequestReceivedSubject: (groupName) => `Deine Anfrage, ${groupName} beizutreten, wurde gesendet`,
  joinRequestDeclinedSubject: (groupName) => `Zu deiner Anfrage, ${groupName} beizutreten`,
  joinRequestUnansweredSubject: (groupName) => `Deine Anfrage, ${groupName} beizutreten, wartet noch auf Antwort`,
  roleGrantedSubject: ({ roleName, groupName }) => `Du hast eine neue Rolle in ${groupName}: ${roleName}`,
  stewardWeeklySubject: (groupName) => `Diese Woche in ${groupName}, für Stewards`,
  textForPostModeratedFulfillment: ({ post, actor, reason }) => {
    const postName = post.summary()
    if (reason === 'postUnfulfilled') {
      return `${actor.get('name')} hat deinen Beitrag „${postName}“ wieder geöffnet`
    }
    return `${actor.get('name')} hat deinen Beitrag „${postName}“ geschlossen`
  },
  textForPostMention: ({ person, postName }) => `${person} hat dich erwähnt: ${postName}`,
  textForOpenRequestNudge: ({ postName, type }) => type === 'offer'
    ? `Noch keine Antworten auf dein Angebot „${postName}“. Ist es noch verfügbar?`
    : `Noch keine Antworten auf deine Anfrage „${postName}“. Wird es noch gebraucht?`,
  textForPost: ({ firstTag, person, postName }) => `${person}: ${postName}${firstTag ? ` #${firstTag}` : ''}`,
  textForTrackCompleted: ({ actor, trackName }) => `Lernpfad abgeschlossen: „${trackName}“ von ${actor.get('name')} abgeschlossen`,
  textForTrackEnrollment: ({ actor, trackName }) => `Lernpfad-Teilnahme: „${trackName}“ von ${actor.get('name')} begonnen`,
  textForVoteReset: ({ person, postName, groupName }) => `${person} hat die Optionen für den Vorschlag „${postName}“ in ${groupName} geändert. Die Stimmen wurden zurückgesetzt`,
  textForReaction: ({ person, others, postName, onComment }) => {
    const who = others > 0 ? `${person} und ${others} ${others === 1 ? 'weitere Person' : 'weitere Personen'}` : person
    const verb = others > 0 ? 'haben' : 'hat'
    return onComment ? `${who} ${verb} auf deinen Kommentar zu „${postName}“ reagiert` : `${who} ${verb} auf deinen Beitrag „${postName}“ reagiert`
  },
  textForEventRsvp: ({ person, others, postName, response }) => {
    if (others > 0) return `${person} und ${others} ${others === 1 ? 'weitere Person haben' : 'weitere Personen haben'} auf deine Veranstaltung „${postName}“ geantwortet`
    return response === 'interested' ? `${person} interessiert sich für deine Veranstaltung „${postName}“` : `${person} nimmt an deiner Veranstaltung „${postName}“ teil`
  },
  textForProposalClosingSoon: ({ postName }) => `Die Abstimmung über „${postName}“ endet bald. Du hast noch nicht abgestimmt`,
  textForProposalClosed: ({ postName, winningOption, tie, forAuthor }) => {
    const result = winningOption ? `: ${winningOption}` : tie ? ': Gleichstand' : ''
    return forAuthor
      ? `Die Abstimmung über deinen Vorschlag „${postName}“ ist beendet${result}. Halte das Ergebnis für die Abstimmenden fest`
      : `Die Abstimmung über „${postName}“ ist beendet${result}`
  },
  textForProposalOutcome: ({ person, postName, outcome }) => `${person} hat das Ergebnis von „${postName}“ festgehalten: ${outcome}`,
  textForEventReminder: ({ postName, date }) => `Erinnerung: „${postName}“ steht bevor, ${date}`,
  textForProjectJoined: ({ person, postName }) => `${person} ist deinem Projekt „${postName}“ beigetreten`,
  textForRequestHelped: ({ person, postName }) => `${person} hat „${postName}“ als erledigt markiert und sagt, dass du geholfen hast. Danke!`,
  fundingRoundResultText: ({ results = [], total, tokenType, hidden }) => {
    if (hidden) return 'Die Verantwortlichen melden sich mit den Ergebnissen.'
    return results.map(({ title, tokens, rank }) => `Deine Einreichung „${title}“ hat ${tokens} ${tokenType || 'Stimmen'} erhalten und den ${rank}. von ${total} Plätzen belegt.`).join(' ')
  },
  textForFundingRoundNewSubmission: ({ fundingRoundTitle, post, actor }) => `${actor.get('name')} hat „${post.summary()}“ für „${fundingRoundTitle}“ eingereicht`,
  textForFundingRoundPhaseTransition: ({ fundingRoundTitle, phase }) => {
    const phaseMessages = {
      submissions: 'Einreichungen sind jetzt offen',
      discussion: 'Einreichungen sind geschlossen, Diskussionen sind offen',
      voting: 'Abstimmung ist jetzt offen',
      completed: 'Abstimmung ist geschlossen, die Runde ist beendet'
    }
    return `${fundingRoundTitle}: ${phaseMessages[phase] || 'Status aktualisiert'}`
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
