exports.es = {
  apiInviteMessageContent: (name) => `${name} se complace en invitarlo a unirse a nuestra comunidad en Hylo.`,
  apiInviteMessageSubject: (name) => `Únete a mí ${name} en Hylo!`,
  clientInviteSubjectDefault: (name) => `Te han invitado a unirte a ${name} en Hylo`,
  clientInviteMessageDefault: ({ userName, groupName }) => `Hola ${userName}, <br><br> Estamos emocionados de darle la bienvenida a nuestra comunidad. Haga clic a continuación para unirse ${groupName} en Hylo.`,
  commentDigestMentionedIn: () => 'Te mencionaron en',
  commentDigestNewCommentsOn: () => 'Nuevos comentarios en',
  createInvitationSubject: (name) => `Únete a mí ${name} en Hylo!`,
  createInvitationMessage: (name) => `¡Hola!\n\nTe invito a unirte a ${name} en Hylo.\n\n${name} está usando Hylo para nuestra comunidad en línea: este es nuestro espacio dedicado a la comunicación y la colaboración.`,
  invitationOptOutTitle: () => 'Dejar de recibir invitaciones',
  invitationOptOutQuestion: (email) => `¿Dejar de enviar invitaciones a ${email}?`,
  invitationOptOutExplanation: () => 'Nadie podrá invitar a esta dirección a un grupo en Hylo.',
  invitationOptOutButton: () => 'Dejar de recibir invitaciones',
  invitationOptOutDone: (email) => `Listo. ${email} no recibirá más invitaciones de Hylo.`,
  invitationOptOutNotFound: () => 'Este enlace ya no funciona.',
  invitationOptOutError: () => 'Algo salió mal. Por favor, inténtalo de nuevo.',
  CreatorEmail: () => 'Correo Electrónico del Creador',
  CreatorName: () => 'Nombre del Creador',
  CreatorURL: () => 'URL del creador',
  clearedPostEmailContent: ({ post, group }) => `Tu publicación "${post.title()}" en el grupo ${group.get('name')} fue eliminada por violar un acuerdo de grupo. \n`,
  Group: () => 'Grupo',
  emailDigestDailySubject: (name) => `Tu resumen diario de ${name}`,
  emailDigestWeeklySubject: (name) => `Tu resumen semanal de ${name}`,
  emailDigestUnifiedDailySubject: () => 'Tu resumen diario de Hylo',
  emailDigestUnifiedWeeklySubject: () => 'Tu resumen semanal de Hylo',
  // D9: in the first weekly digest after a daily digest was slowed down for being away
  emailDigestSlowedNotice: () => 'Mientras no estabas, redujimos tus correos a un resumen semanal. Visita Hylo cuando quieras para volver a recibir tu resumen diario.',
  emailDigestTopPostSubject: ({ title, count, groupName }) => count > 0 ? `${title} +${count} más en ${groupName}` : `${title} en ${groupName}`,
  emailDigestUnifiedTopPostSubject: ({ title, count }) => count > 0 ? `${title} +${count} más en tus grupos` : title,
  emailDigestWeeklyMixupNotice: () => 'Perdón por la pausa: hasta agosto, los resúmenes semanales como este se enviaban por error una vez al mes. Ya está solucionado y a partir de ahora recibirás este resumen cada semana.',
  emailSenderViaHyloSuffix: () => ' (vía Hylo)',
  groupCreatedNotifySubject: (name) => `Nuevo Grupo de Hylo Creado: ${name}`,
  fundingRoundTransitionButtonText: ({ phase }) => {
    const buttonTextMessages = {
      submissions: 'Agregar tu presentación',
      discussion: 'Discutir las presentaciones',
      voting: 'Votar en la ronda',
      completed: 'Ver los resultados',
      viewRound: 'Ver la Ronda'
    }
    return buttonTextMessages[phase] || 'Ver la ronda'
  },
  fundingRoundTransitionText: ({ phase }) => {
    const transitionTextMessages = {
      submissions: 'Las presentaciones están ahora abiertas',
      discussion: 'Las presentaciones están ahora cerradas',
      voting: 'La votación está ahora abierta',
      completed: 'La votación está ahora cerrada'
    }
    return transitionTextMessages[phase] || 'Estado actualizado'
  },
  moderationClearedFlagFromYourPost: () => 'El moderador eliminó una denuncia de tu publicación',
  moderationClearedPostEmailContent: ({ post, group }) => `Tu publicación "${post.summary()}" en el grupo ${group.get('name')} fue eliminada por violar un acuerdo de grupo. \n`,
  moderationClearedYourFlag: () => 'El moderador eliminó tu denuncia',
  moderationFlaggedPostEmailContent: ({ post, group }) => `Tu publicación "${post.summary()}" en el grupo ${group.get('name')} fue denunciada como violando un acuerdo de grupo. \n`,
  moderationReporterClearedPostEmailContent: ({ post, group }) => `La publicación "${post.summary()}" en el grupo ${group.get('name')} que denunciaste fue eliminada por violar un acuerdo de grupo. \n`,
  moderationYouFlaggedAPost: () => 'Has denunciado una publicación',
  rsvpGoing: () => 'asistiendo a',
  rsvpInterested: () => 'interesado/a en',
  rsvpNotGoing: () => 'ausente de',
  moderationYouFlaggedPostEmailContent: ({ post, group }) => `Has denunciado la publicación "${post.summary()}" en el grupo ${group.get('name')} como violando un acuerdo de grupo. \n`,
  moderationYourPostWasFlagged: () => 'Tu publicación fue denunciada',
  moderationYouFlaggedAComment: () => 'Has denunciado un comentario',
  moderationYourCommentWasFlagged: () => 'Tu comentario fue denunciado',
  moderationClearedFlagFromYourComment: () => 'El moderador eliminó una denuncia de tu comentario',
  moderationYouFlaggedCommentEmailContent: ({ summary, group }) => `Has denunciado el comentario "${summary}" en el grupo ${group.get('name')} como violando un acuerdo de grupo. \n`,
  moderationFlaggedCommentEmailContent: ({ summary, group }) => `Tu comentario "${summary}" en el grupo ${group.get('name')} fue denunciado como violando un acuerdo de grupo. \n`,
  moderationClearedCommentEmailContent: ({ summary, group }) => `Se retiró la denuncia de tu comentario "${summary}" en el grupo ${group.get('name')}; no viola ningún acuerdo de grupo. \n`,
  moderationReporterClearedCommentEmailContent: ({ summary, group }) => `Se retiró la denuncia del comentario "${summary}" en el grupo ${group.get('name')} que denunciaste; no viola ningún acuerdo de grupo. \n`,
  moderationPostClosedEmailSubject: () => 'Tu publicación fue cerrada',
  moderationPostReopenedEmailSubject: () => 'Tu publicación fue reabierta',
  moderationPostClosedEmailContent: ({ post, group, actor }) => `${actor.get('name')} cerró tu publicación "${post.summary()}" en el grupo ${group.get('name')}. \n`,
  moderationPostReopenedEmailContent: ({ post, group, actor }) => `${actor.get('name')} reabrió tu publicación "${post.summary()}" en el grupo ${group.get('name')}. \n`,
  Name: () => 'Nombre',
  newSavedSearchResults: (name) => `Nuevos resultados de búsqueda guardados en ${name}`,
  recentActivityFrom: (name) => `Actividad reciente de ${name}`,
  textForAnnouncement: ({ person, postName }) => `Anuncio de ${person}: ${postName}`,
  textForApprovedJoinRequest: ({ actor, groupName }) => `${actor.get('name')} aprobó tu solicitud para unirte ${groupName}`,
  textForChatPost: ({ firstTag, person, postName }) => `${person}: ${postName}${firstTag ? ` #${firstTag}` : ''}`,
  textForCommentImage: person => `${person} envió una imagen`,
  textForCommentMention: ({ person, blurb, postName }) => `${person} te mencionó: "${blurb}" (en "${postName}")`,
  textForComment: ({ person, blurb, postName }) => `${person}: "${blurb}" (en "${postName}")`,
  textForContribution: post => `Se le ha agregado como colaborador de la solicitud: "${post.summary()}"`,
  textForDonationTo: ({ amount, postName }) => `Contribuiste con $${amount} a "${postName}"`,
  textForDonationFrom: ({ amount, actor, postName }) => `${actor.get('name')} contribuyó $${amount} a "${postName}"`,
  textForEventInvitation: ({ actor, postName }) => `${actor.get('name')} te invitó a "${postName}"`,
  textForJoinRequest: ({ actor, groupName, parentGroupName }) => parentGroupName
    ? `${actor.get('name')} pidió unirse a ${groupName} en ${parentGroupName}`
    : `${actor.get('name')} pidió unirte ${groupName}`,
  textForGroupInvitation: ({ actor, groupName, parentGroupName }) => parentGroupName
    ? `${actor.get('name')} te ha invitado a unirte al espacio ${groupName} en ${parentGroupName}`
    : `${actor.get('name')} te ha invitado a unirte a ${groupName}`,
  textForGroupInvitationAccepted: ({ actor, groupName }) => `${actor.get('name')} aceptó tu invitación para unirse ${groupName}`,
  textForGroupChildGroupInvite: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} invitó a tu grupo ${childGroup.get('name')} a unirse a su grupo ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} aceptó su invitación de su grupo ${childGroup.get('name')} para unirse a su grupo ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} aceptó la invitación de su grupo ${childGroup.get('name')} para unirse a su grupo. ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedParentMember: ({ parentGroup, childGroup }) => `El grupo ${childGroup.get('name')} acaba de unirse a su grupo ${parentGroup.get('name')}!`,
  textForGroupChildGroupInviteAcceptedChildMember: ({ parentGroup, childGroup }) => `Tu grupo ${childGroup.get('name')} se ha unido a ${parentGroup.get('name')}. Ya puedes unirte a ${parentGroup.get('name')}!`,
  textForGroupParentGroupJoinRequest: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} solicita agregar su grupo ${childGroup.get('name')} como miembro de su grupo ${parentGroup.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} aceptó una solicitud para agregar ${childGroup.get('name')} a su grupo ${parentGroup.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `Tu grupo ${childGroup.get('name')} ha sido aceptado como miembro de ${parentGroup.get('name')} por ${actor.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedParentMember: ({ parentGroup, childGroup }) => `¡El grupo ${childGroup.get('name')} acaba de unirse a su grupo ${parentGroup.get('name')}!`,
  textForGroupParentGroupJoinRequestAcceptedChildMember: ({ parentGroup, childGroup }) => `Tu grupo ${childGroup.get('name')} te ha unido a ${parentGroup.get('name')}.`,
  textForGroupPeerGroupInvite: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} invitó a tu grupo ${toGroup.get('name')} a formar una relación de pares con ${fromGroup.get('name')}`,
  textForGroupPeerGroupInviteAccepted: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} aceptó la relación de pares entre ${fromGroup.get('name')} y ${toGroup.get('name')}`,
  textForMemberJoinedGroup: ({ group, actor }) => `Un nuevo miembro se ha unido a ${group.get('name')}: ${actor.get('name')}`,
  joinRequestReceivedSubject: (groupName) => `Enviamos tu solicitud para unirte a ${groupName}`,
  joinRequestDeclinedSubject: (groupName) => `Sobre tu solicitud para unirte a ${groupName}`,
  joinRequestUnansweredSubject: (groupName) => `Tu solicitud para unirte a ${groupName} sigue esperando respuesta`,
  roleGrantedSubject: ({ roleName, groupName }) => `Tienes un nuevo rol en ${groupName}: ${roleName}`,
  stewardWeeklySubject: (groupName) => `Esta semana en ${groupName}, para administradores`,
  textForPostModeratedFulfillment: ({ post, actor, reason }) => {
    const postName = post.summary()
    if (reason === 'postUnfulfilled') {
      return `${actor.get('name')} reabrió tu publicación "${postName}"`
    }
    return `${actor.get('name')} cerró tu publicación "${postName}"`
  },
  textForPostMention: ({ person, postName }) => `${person} te mencionó: ${postName}`,
  textForOpenRequestNudge: ({ postName, type }) => type === 'offer'
    ? `Todavía no hay respuestas a tu oferta "${postName}". ¿Sigue disponible?`
    : `Todavía no hay respuestas a tu solicitud "${postName}". ¿Todavía lo necesitas?`,
  textForPost: ({ firstTag, person, postName }) => `${person}: ${postName}${firstTag ? ` #${firstTag}` : ''}`,
  textForTrackCompleted: ({ actor, trackName }) => `Pista completada: "${trackName}" fue completada por ${actor.get('name')}`,
  textForTrackEnrollment: ({ actor, trackName }) => `Inscripción en pista: "${trackName}" fue inscrita por ${actor.get('name')}`,
  textForVoteReset: ({ person, postName, groupName }) => `${person} cambió las opciones de propuesta: "${postName}" en ${groupName}. Esto ha reiniciado los votos`,
  textForReaction: ({ person, others, postName, onComment }) => {
    const who = others > 0 ? `${person} y ${others} ${others === 1 ? 'persona más' : 'personas más'}` : person
    const verb = others > 0 ? 'reaccionaron' : 'reaccionó'
    return onComment ? `${who} ${verb} a tu comentario en "${postName}"` : `${who} ${verb} a tu publicación "${postName}"`
  },
  textForEventRsvp: ({ person, others, postName, response }) => {
    if (others > 0) return `${person} y ${others} ${others === 1 ? 'persona más' : 'personas más'} respondieron a tu evento "${postName}"`
    return response === 'interested' ? `A ${person} le interesa tu evento "${postName}"` : `${person} asistirá a tu evento "${postName}"`
  },
  textForProposalClosingSoon: ({ postName }) => `La votación sobre "${postName}" cierra pronto. Todavía no has votado`,
  textForProposalClosed: ({ postName, winningOption, tie, forAuthor }) => {
    const result = winningOption ? `: ${winningOption}` : tie ? ': empate' : ''
    return forAuthor
      ? `La votación de tu propuesta "${postName}" terminó${result}. Registra el resultado para quienes votaron`
      : `La votación sobre "${postName}" terminó${result}`
  },
  textForProposalOutcome: ({ person, postName, outcome }) => `${person} registró el resultado de "${postName}": ${outcome}`,
  textForEventReminder: ({ postName, date }) => `Recordatorio: "${postName}" se acerca, ${date}`,
  textForProjectJoined: ({ person, postName }) => `${person} se unió a tu proyecto "${postName}"`,
  textForRequestHelped: ({ person, postName }) => `${person} marcó "${postName}" como resuelta y dice que ayudaste. ¡Gracias!`,
  fundingRoundResultText: ({ results = [], total, tokenType, hidden }) => {
    if (hidden) return 'Las personas administradoras compartirán los resultados.'
    return results.map(({ title, tokens, rank }) => `Tu propuesta "${title}" recibió ${tokens} ${tokenType || 'votos'} y quedó en el puesto ${rank} de ${total}.`).join(' ')
  },
  textForFundingRoundNewSubmission: ({ fundingRoundTitle, post, actor }) => `${actor.get('name')} presentó "${post.summary()}" a "${fundingRoundTitle}"`,
  textForFundingRoundPhaseTransition: ({ fundingRoundTitle, phase }) => {
    const phaseMessages = {
      submissions: 'Las presentaciones están ahora abiertas',
      discussion: 'Las presentaciones han cerrado y las discusiones están abiertas',
      voting: 'La votación está ahora abierta',
      completed: 'La votación ha cerrado y la ronda ha terminado'
    }
    return `${fundingRoundTitle}: ${phaseMessages[phase] || 'Estado actualizado'}`
  },
  textForFundingRoundReminder: ({ reminderType }) => {
    const reminderMessages = {
      submissionsClosing1Day: 'Las presentaciones cierran en 1 día',
      submissionsClosing3Days: 'Las presentaciones cierran en 3 días',
      votingClosing1Day: 'La votación cierra en 1 día',
      votingClosing3Days: 'La votación cierra en 3 días'
    }
    return `${reminderMessages[reminderType] || 'Fecha límite próxima'}`
  },
  theTeamAtHylo: 'El equipo de Hylo',
  stripeContributionProductName: () => 'Elige tu contribución a Hylo',
  stripeContributionProductDescription: () => 'Elige tu nivel de contribución para apoyar la plataforma Hylo.',
  stripeSlidingScaleUnitProductName: ({ currency }) => `Define el monto de tu contribución (unidades ${currency})`,
  stripeSlidingScaleUnitProductDescription: () => 'Ajusta la cantidad para elegir el monto de tu contribución.',
  donationTaxReceiptInfo: () => '',
  donationImpactMessage: () => 'Tu contribución ayuda a apoyar la plataforma Hylo y nuestra misión de permitir una mejor coordinación y colaboración en comunidades de todo el mundo.',
  donationRecurringImpactMessage: () => 'Tu contribución recurrente ayuda a apoyar la plataforma Hylo y nuestra misión de permitir una mejor coordinación y colaboración en comunidades de todo el mundo.'
}
