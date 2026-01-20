exports.es = {
  apiInviteMessageContent: (name) => `${name} se complace en invitarlo a unirse a nuestra comunidad en Hylo.`,
  apiInviteMessageSubject: (name) => `Únete a mí ${name} en Hylo!`,
  clientInviteSubjectDefault: (name) => `You've been invited to join ${name} on Hylo`,
  clientInviteMessageDefault: ({ userName, groupName }) => `Hola ${userName}, <br><br> Estamos emocionados de darle la bienvenida a nuestra comunidad. Haga clic a continuación para unirse ${groupName} en Hylo.`,
  createInvitationSubject: (name) => `Únete a mí ${name} en Hylo!`,
  CreatorEmail: () => 'Correo Electrónico del Creador',
  CreatorName: () => 'Nombre del Creador',
  CreatorURL: () => 'URL del creador',
  clearedPostEmailContent: ({ post, group }) => `Tu publicación "${post.title()}" en el grupo ${group.get('name')} fue eliminada por violar un acuerdo de grupo. \n`,
  Group: () => 'Grupo',
  emailDigestDailySubject: (name) => `Tu resumen diario de ${name}`,
  emailDigestWeeklySubject: (name) => `Tu resumen semanal de ${name}`,
  groupCreatedNotifySubject: (name) => `Nuevo Grupo de Hylo Creado: ${name}`,
  fundingRoundTransitionButtonText: ({ phase }) => {
    const buttonTextMessages = {
      submissionsOpen: 'Agregar tu presentación',
      submissionsClose: 'Discutir las presentaciones',
      votingOpens: 'Votar en la ronda',
      votingCloses: 'Ver los resultados',
      viewRound: 'Ver la Ronda'
    }
    return buttonTextMessages[phase] || 'Ver la ronda'
  },
  fundingRoundTransitionText: ({ phase }) => {
    const transitionTextMessages = {
      submissionsOpen: 'Las presentaciones están ahora abiertas',
      submissionsClose: 'Las presentaciones están ahora cerradas',
      votingOpens: 'La votación está ahora abierta',
      votingCloses: 'La votación está ahora cerrada'
    }
    return transitionTextMessages[phase] || 'Estado actualizado'
  },
  moderationClearedFlagFromYourPost: () => 'El moderador eliminó una denuncia de tu publicación',
  moderationClearedPostEmailContent: ({ post, group }) => `Tu publicación "${post.summary()}" en el grupo ${group.get('name')} fue eliminada por violar un acuerdo de grupo. \n`,
  moderationClearedYourFlag: () => 'El moderador eliminó tu denuncia',
  moderationFlaggedPostEmailContent: ({ post, group }) => `Tu publicación "${post.summary()}" en el grupo ${group.get('name')} fue denunciada como violando un acuerdo de grupo. \n`,
  moderationReporterClearedPostEmailContent: ({ post, group }) => `La publicación "${post.summary()}" en el grupo ${group.get('name')} que denunciaste fue eliminada por violar un acuerdo de grupo. \n`,
  moderationYouFlaggedAPost: () => 'Has denunciado una publicación',
  moderationYouFlaggedPostEmailContent: ({ post, group }) => `Has denunciado la publicación "${post.summary()}" en el grupo ${group.get('name')} como violando un acuerdo de grupo. \n`,
  moderationYourPostWasFlagged: () => 'Tu publicación fue denunciada',
  Name: () => 'Nombre',
  newSavedSearchResults: (name) => `Nuevos resultados de búsqueda guardados en ${name}`,
  recentActivityFrom: (name) => `Actividad reciente de ${name}`,
  textForAnnouncement: ({ groupName, person, postName }) => `${person} envió un anuncio titulado "${postName}" en ${groupName}`,
  textForApprovedJoinRequest: ({ actor, groupName }) => `${actor.get('name')} aprobó tu solicitud para unirte ${groupName}`,
  textForChatPost: ({ firstTag, groupName, person, postName }) => `${person} habló "${postName}" en ${groupName}${firstTag ? ` #${firstTag}` : ''}`,
  textForCommentImage: person => `${person} envió una imagen`,
  textForCommentMention: ({ person, blurb, postName }) => `${person} te mencionó: "${blurb}" (en "${postName}")`,
  textForComment: ({ person, blurb, postName }) => `${person}: "${blurb}" (en "${postName}")`,
  textForContribution: post => `Se le ha agregado como colaborador de la solicitud: "${post.summary()}"`,
  textForDonationTo: ({ amount, postName }) => `Contribuiste con $${amount} a "${postName}"`,
  textForDonationFrom: ({ amount, actor, postName }) => `${actor.get('name')} contribuyó $${amount} a "${postName}"`,
  textForEventInvitation: ({ actor, postName }) => `${actor.get('name')} Julia te invitó a "${postName}"`,
  textForJoinRequest: ({ actor, groupName }) => `${actor.get('name')} pidió unirte ${groupName}`,
  textForGroupInvitation: ({ actor, groupName }) => `${actor.get('name')} te invitó a unirte ${groupName}`,
  textForGroupInvitationAccepted: ({ actor, groupName }) => `${actor.get('name')} aceptó tu invitación para unirse ${groupName}`,
  textForGroupChildGroupInvite: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} invitó a tu grupo ${childGroup.get('name')} a unirse a su grupo ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} aceptó su invitación de su grupo ${childGroup.get('name')} para unirse a su grupo ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} aceptó la invitación de su grupo ${childGroup.get('name')} para unirse a su grupo. ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedParentMember: ({ parentGroup, childGroup }) => `El grupo ${childGroup.get('name')} acaba de unirse a su grupo ${parentGroup.get('name')}!`,
  textForGroupChildGroupInviteAcceptedChildMember: ({ parentGroup, childGroup }) => `Tu grupo ${childGroup.get('name')} se ha unido a ${parentGroup.get('name')}. Ya puedes unirte a ${parentGroup.get('name')}!`,
  textForGroupParentGroupJoinRequest: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} solicita agregar su grupo ${childGroup.get('name')} como miembro de su grupo ${parentGroup.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} aceptó una solicitud para agregar ${childGroup.get('name')} a su grupo ${parentGroup.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `Tu grupo ${childGroup.get('name')} ha sido aceptado como miembro de ${parentGroup.get('name')} por ${actor.get('name')}`,
  textForGroupParentGroupInviteAcceptedParentMember: ({ parentGroup, childGroup }) => `¡El grupo ${childGroup.get('name')} acaba de unirse a su grupo ${parentGroup.get('name')}!`,
  textForGroupParentGroupJoinRequestAcceptedChildMember: ({ parentGroup, childGroup }) => `Tu grupo ${childGroup.get('name')} te ha unido a ${parentGroup.get('name')}.`,
  textForGroupPeerGroupInvite: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} invitó a tu grupo ${toGroup.get('name')} a formar una relación de pares con ${fromGroup.get('name')}`,
  textForGroupPeerGroupInviteAccepted: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} aceptó la relación de pares entre ${fromGroup.get('name')} y ${toGroup.get('name')}`,
  textForMemberJoinedGroup: ({ group, actor }) => `Un nuevo miembro se ha unido a ${group.get('name')}: ${actor.get('name')}`,
  textForPostMention: ({ groupName, person, postName }) => `${person} te mencionó en "${postName}" en ${groupName}`,
  textForPost: ({ firstTag, groupName, person, postName }) => `${person} publicó "${postName}" en ${groupName}${firstTag ? ` #${firstTag}` : ''}`,
  textForTrackCompleted: ({ actor, track }) => `Pista completada: "${track.get('name')}" fue completada por ${actor.get('name')}`,
  textForTrackEnrollment: ({ actor, track }) => `Inscripción en pista: "${track.get('name')}" fue inscrita por ${actor.get('name')}`,
  textForVoteReset: ({ person, postName, groupName }) => `${person} cambió las opciones de propuesta: "${postName}" en ${groupName}. Esto ha reiniciado los votos`,
  textForFundingRoundNewSubmission: ({ fundingRound, post, actor }) => `${actor.get('name')} presentó "${post.summary()}" a "${fundingRound.get('title')}"`,
  textForFundingRoundPhaseTransition: ({ fundingRound, phase }) => {
    const phaseMessages = {
      submissionsOpen: 'Las presentaciones están ahora abiertas',
      submissionsClose: 'Las presentaciones han cerrado y las discusiones están abiertas',
      votingOpens: 'La votación está ahora abierta',
      votingCloses: 'La votación ha cerrado y la ronda ha terminado'
    }
    return `${fundingRound.get('title')}: ${phaseMessages[phase] || 'Estado actualizado'}`
  },
  textForFundingRoundReminder: ({ fundingRound, reminderType }) => {
    const reminderMessages = {
      submissionsClosing1Day: 'Las presentaciones cierran en 1 día',
      submissionsClosing3Days: 'Las presentaciones cierran en 3 días',
      votingClosing1Day: 'La votación cierra en 1 día',
      votingClosing3Days: 'La votación cierra en 3 días'
    }
    return `${fundingRound.get('title')}: ${reminderMessages[reminderType] || 'Fecha límite próxima'}`
  },
  theTeamAtHylo: 'El equipo de Hylo'
}
