exports.fr = {
  apiInviteMessageContent: (name) => `${name} a le plaisir de vous inviter à rejoindre notre communauté sur Hylo.`,
  apiInviteMessageSubject: (name) => `Rejoignez-moi dans ${name} sur Hylo !`,
  clientInviteSubjectDefault: (name) => `Vous avez été invité·e à rejoindre ${name} sur Hylo`,
  clientInviteMessageDefault: ({ userName, groupName }) => `Bonjour ${userName}, <br><br> Nous sommes ravis de vous accueillir dans notre communauté. Cliquez ci-dessous pour rejoindre ${groupName} sur Hylo.`,
  CreatorEmail: () => 'E-mail du créateur',
  createInvitationSubject: (name) => `Rejoignez-moi dans ${name} sur Hylo !`,
  CreatorName: () => 'Nom du créateur',
  CreatorURL: () => 'URL du créateur',
  Group: () => 'Groupe',
  emailDigestDailySubject: (name) => `Votre résumé quotidien ${name}`,
  emailDigestWeeklySubject: (name) => `Votre résumé hebdomadaire ${name}`,
  groupCreatedNotifySubject: (name) => `Nouveau groupe Hylo créé : ${name}`,
  fundingRoundTransitionButtonText: ({ phase }) => {
    const buttonTextMessages = {
      submissions: 'Ajouter votre contribution',
      discussion: 'Discuter des contributions',
      voting: 'Voter pour la manche',
      completed: 'Voir les résultats',
      viewRound: 'Voir la manche'
    }
    return buttonTextMessages[phase] || 'Voir la manche'
  },
  fundingRoundTransitionText: ({ phase }) => {
    const transitionTextMessages = {
      submissions: 'Les contributions sont ouvertes',
      discussion: 'Les contributions sont closes',
      voting: 'Le vote est ouvert',
      completed: 'Le vote est clos'
    }
    return transitionTextMessages[phase] || 'Statut mis à jour'
  },
  moderationClearedFlagFromYourPost: () => 'Un modérateur a levé un signalement sur votre publication',
  moderationClearedPostEmailContent: ({ post, group }) => `Votre publication « ${post.summary()} » dans le groupe ${group.get('name')} a été dégagée de toute violation d’accord de groupe. \n`,
  moderationClearedYourFlag: () => 'Un modérateur a levé votre signalement',
  moderationFlaggedPostEmailContent: ({ post, group }) => `Votre publication « ${post.summary()} » dans le groupe ${group.get('name')} a été signalée comme violant un accord de groupe. \n`,
  moderationReporterClearedPostEmailContent: ({ post, group }) => `La publication « ${post.summary()} » dans le groupe ${group.get('name')} que vous avez signalée a été dégagée de toute violation d’accord de groupe. \n`,
  moderationYouFlaggedAPost: () => 'Vous avez signalé une publication',
  moderationYouFlaggedPostEmailContent: ({ post, group }) => `Vous avez signalé la publication « ${post.summary()} » dans le groupe ${group.get('name')} comme violant un accord de groupe. \n`,
  moderationYourPostWasFlagged: () => 'Votre publication a été signalée',
  Name: () => 'Nom',
  newSavedSearchResults: (name) => `Nouveaux résultats de recherche enregistrée dans ${name}`,
  textForApprovedJoinRequest: ({ actor, groupName }) => `${actor.get('name')} a accepté votre demande pour rejoindre ${groupName}`,
  textForAnnouncement: ({ person, postName, groupName }) => `${person} a envoyé une annonce « ${postName} » à ${groupName}`,
  textForChatPost: ({ firstTag, groupName, person, postName }) => `${person} a écrit dans le chat « ${postName} » dans ${groupName}${firstTag ? ` #${firstTag}` : ''}`,
  textForCommentImage: person => `${person} a envoyé une image`,
  textForCommentMention: ({ person, blurb, postName }) => `${person} vous a mentionné·e : « ${blurb} » (dans « ${postName} »)`,
  textForComment: ({ person, blurb, postName }) => `${person} : « ${blurb} » (dans « ${postName} »)`,
  textForContribution: post => `Vous avez été ajouté·e comme contributeur·rice à la demande « ${post.summary()} »`,
  textForDonationTo: ({ amount, postName }) => `Vous avez contribué ${amount} $ à « ${postName} »`,
  textForDonationFrom: ({ amount, actor, postName }) => `${actor.get('name')} a contribué ${amount} $ à « ${postName} »`,
  textForGroupChildGroupInvite: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} a invité votre groupe ${childGroup.get('name')} à rejoindre son groupe ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} a accepté votre invitation de son groupe ${childGroup.get('name')} à rejoindre votre groupe ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} a accepté votre invitation de votre groupe ${childGroup.get('name')} à rejoindre son groupe ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedParentMember: ({ parentGroup, childGroup }) => `Le groupe ${childGroup.get('name')} vient de rejoindre votre groupe ${parentGroup.get('name')} !`,
  textForGroupChildGroupInviteAcceptedChildMember: ({ parentGroup, childGroup }) => `Votre groupe ${childGroup.get('name')} a rejoint ${parentGroup.get('name')}. Vous pouvez maintenant rejoindre ${parentGroup.get('name')} !`,
  textForGroupParentGroupJoinRequest: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} demande d’ajouter son groupe ${childGroup.get('name')} comme membre de votre groupe ${parentGroup.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} a accepté une demande d’ajouter ${childGroup.get('name')} à votre groupe ${parentGroup.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `Votre groupe ${childGroup.get('name')} a été accepté comme membre de ${parentGroup.get('name')} par ${actor.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedParentMember: ({ parentGroup, childGroup }) => `Le groupe ${childGroup.get('name')} vient de rejoindre votre groupe ${parentGroup.get('name')} !`,
  textForGroupParentGroupJoinRequestAcceptedChildMember: ({ parentGroup, childGroup }) => `Votre groupe ${childGroup.get('name')} a rejoint ${parentGroup.get('name')}.`,
  textForEventInvitation: ({ actor, postName }) => `${actor.get('name')} vous a invité·e à « ${postName} »`,
  textForGroupInvitation: ({ actor, groupName }) => `${actor.get('name')} vous a invité·e à rejoindre ${groupName}`,
  textForGroupInvitationAccepted: ({ actor, groupName }) => `${actor.get('name')} a accepté votre invitation à rejoindre ${groupName}`,
  textForGroupPeerGroupInvite: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} a invité votre groupe ${toGroup.get('name')} à former un lien de pairs avec ${fromGroup.get('name')}`,
  textForGroupPeerGroupInviteAccepted: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} a accepté le lien de pairs entre ${fromGroup.get('name')} et ${toGroup.get('name')}`,
  textForJoinRequest: ({ actor, groupName }) => `${actor.get('name')} a demandé à rejoindre ${groupName}`,
  textForMemberJoinedGroup: ({ group, actor }) => `Un nouveau membre a rejoint ${group.get('name')} : ${actor.get('name')}`,
  textForPostMention: ({ groupName, person, postName }) => `${person} vous a mentionné·e dans la publication « ${postName} » dans ${groupName}`,
  textForPost: ({ firstTag, groupName, person, postName }) => `${person} a publié « ${postName} » dans ${groupName}${firstTag ? ` #${firstTag}` : ''}`,
  textForTrackCompleted: ({ actor, track }) => `Parcours terminé : « ${track.get('name')} » complété par ${actor.get('name')}`,
  textForTrackEnrollment: ({ actor, track }) => `Inscription au parcours : « ${track.get('name')} » par ${actor.get('name')}`,
  textForVoteReset: ({ person, postName, groupName }) => `${person} a modifié les options de la proposition « ${postName} » dans ${groupName}. Les votes ont été réinitialisés`,
  textForFundingRoundNewSubmission: ({ fundingRound, post, actor }) => `${actor.get('name')} a soumis « ${post.summary()} » pour « ${fundingRound.get('title')} »`,
  textForFundingRoundPhaseTransition: ({ fundingRound, phase }) => {
    const phaseMessages = {
      submissions: 'Les contributions sont ouvertes',
      discussion: 'Les contributions sont closes, les discussions sont ouvertes',
      voting: 'Le vote est ouvert',
      completed: 'Le vote est clos, la manche est terminée'
    }
    return `${fundingRound.get('title')} : ${phaseMessages[phase] || 'Statut mis à jour'}`
  },
  textForFundingRoundReminder: ({ reminderType }) => {
    const reminderMessages = {
      submissionsClosing1Day: 'Les contributions ferment dans 1 jour',
      submissionsClosing3Days: 'Les contributions ferment dans 3 jours',
      votingClosing1Day: 'Le vote se termine dans 1 jour',
      votingClosing3Days: 'Le vote se termine dans 3 jours'
    }
    return `${reminderMessages[reminderType] || 'Échéance proche'}`
  },
  theTeamAtHylo: 'L’équipe Hylo',
  donationTaxReceiptInfo: () => 'Un reçu fiscal sera délivré par notre sponsor fiscal pour vos dossiers.',
  donationImpactMessage: () => 'Votre don soutient la plateforme Hylo et notre mission de meilleure coordination et collaboration entre communautés dans le monde.',
  donationRecurringImpactMessage: () => 'Votre don récurrent soutient la plateforme Hylo et notre mission de meilleure coordination et collaboration entre communautés dans le monde.'
}
