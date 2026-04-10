exports.pt = {
  apiInviteMessageContent: (name) => `${name} tem o prazer de convidar você a entrar na nossa comunidade no Hylo.`,
  apiInviteMessageSubject: (name) => `Junte-se a mim em ${name} no Hylo!`,
  clientInviteSubjectDefault: (name) => `Você foi convidado a entrar em ${name} no Hylo`,
  clientInviteMessageDefault: ({ userName, groupName }) => `Olá, ${userName}, <br><br> Estamos felizes em recebê-lo na nossa comunidade. Clique abaixo para entrar em ${groupName} no Hylo.`,
  CreatorEmail: () => 'E-mail de quem criou',
  createInvitationSubject: (name) => `Junte-se a mim em ${name} no Hylo!`,
  CreatorName: () => 'Nome de quem criou',
  CreatorURL: () => 'URL de quem criou',
  Group: () => 'Grupo',
  emailDigestDailySubject: (name) => `Seu resumo diário de ${name}`,
  emailDigestWeeklySubject: (name) => `Seu resumo semanal de ${name}`,
  groupCreatedNotifySubject: (name) => `Novo grupo Hylo criado: ${name}`,
  fundingRoundTransitionButtonText: ({ phase }) => {
    const buttonTextMessages = {
      submissions: 'Enviar sua contribuição',
      discussion: 'Discutir as contribuições',
      voting: 'Votar na rodada',
      completed: 'Ver os resultados',
      viewRound: 'Ver a rodada'
    }
    return buttonTextMessages[phase] || 'Ver a rodada'
  },
  fundingRoundTransitionText: ({ phase }) => {
    const transitionTextMessages = {
      submissions: 'As inscrições estão abertas',
      discussion: 'As inscrições foram encerradas',
      voting: 'A votação está aberta',
      completed: 'A votação foi encerrada'
    }
    return transitionTextMessages[phase] || 'Status atualizado'
  },
  moderationClearedFlagFromYourPost: () => 'Um moderador removeu uma denúncia da sua publicação',
  moderationClearedPostEmailContent: ({ post, group }) => `Sua publicação “${post.summary()}” no grupo ${group.get('name')} foi liberada de violação de acordo do grupo. \n`,
  moderationClearedYourFlag: () => 'Um moderador removeu sua denúncia',
  moderationFlaggedPostEmailContent: ({ post, group }) => `Sua publicação “${post.summary()}” no grupo ${group.get('name')} foi denunciada por violar um acordo do grupo. \n`,
  moderationReporterClearedPostEmailContent: ({ post, group }) => `A publicação “${post.summary()}” no grupo ${group.get('name')} que você denunciou foi liberada de violação de acordo do grupo. \n`,
  moderationYouFlaggedAPost: () => 'Você denunciou uma publicação',
  moderationYouFlaggedPostEmailContent: ({ post, group }) => `Você denunciou a publicação “${post.summary()}” no grupo ${group.get('name')} por violar um acordo do grupo. \n`,
  moderationYourPostWasFlagged: () => 'Sua publicação foi denunciada',
  Name: () => 'Nome',
  newSavedSearchResults: (name) => `Novos resultados da pesquisa salva em ${name}`,
  textForApprovedJoinRequest: ({ actor, groupName }) => `${actor.get('name')} aprovou seu pedido para entrar em ${groupName}`,
  textForAnnouncement: ({ person, postName, groupName }) => `${person} enviou um anúncio “${postName}” para ${groupName}`,
  textForChatPost: ({ firstTag, groupName, person, postName }) => `${person} conversou “${postName}” em ${groupName}${firstTag ? ` #${firstTag}` : ''}`,
  textForCommentImage: person => `${person} enviou uma imagem`,
  textForCommentMention: ({ person, blurb, postName }) => `${person} mencionou você: “${blurb}” (em “${postName}”)`,
  textForComment: ({ person, blurb, postName }) => `${person}: “${blurb}” (em “${postName}”)`,
  textForContribution: post => `Você foi adicionado como colaborador do pedido “${post.summary()}”`,
  textForDonationTo: ({ amount, postName }) => `Você contribuiu com US$ ${amount} para “${postName}”`,
  textForDonationFrom: ({ amount, actor, postName }) => `${actor.get('name')} contribuiu com US$ ${amount} para “${postName}”`,
  textForGroupChildGroupInvite: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} convidou seu grupo ${childGroup.get('name')} a entrar no grupo deles ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} aceitou seu convite para o grupo deles ${childGroup.get('name')} entrar no seu grupo ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} aceitou seu convite para seu grupo ${childGroup.get('name')} entrar no grupo deles ${parentGroup.get('name')}`,
  textForGroupChildGroupInviteAcceptedParentMember: ({ parentGroup, childGroup }) => `O grupo ${childGroup.get('name')} acabou de entrar no seu grupo ${parentGroup.get('name')}!`,
  textForGroupChildGroupInviteAcceptedChildMember: ({ parentGroup, childGroup }) => `Seu grupo ${childGroup.get('name')} entrou em ${parentGroup.get('name')}. Agora você pode entrar em ${parentGroup.get('name')}!`,
  textForGroupParentGroupJoinRequest: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} está pedindo para adicionar o grupo ${childGroup.get('name')} como membro do seu grupo ${parentGroup.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} aceitou um pedido para adicionar ${childGroup.get('name')} ao seu grupo ${parentGroup.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `Seu grupo ${childGroup.get('name')} foi aceito como membro de ${parentGroup.get('name')} por ${actor.get('name')}`,
  textForGroupParentGroupJoinRequestAcceptedParentMember: ({ parentGroup, childGroup }) => `O grupo ${childGroup.get('name')} acabou de entrar no seu grupo ${parentGroup.get('name')}!`,
  textForGroupParentGroupJoinRequestAcceptedChildMember: ({ parentGroup, childGroup }) => `Seu grupo ${childGroup.get('name')} entrou em ${parentGroup.get('name')}.`,
  textForEventInvitation: ({ actor, postName }) => `${actor.get('name')} convidou você para “${postName}”`,
  textForGroupInvitation: ({ actor, groupName }) => `${actor.get('name')} convidou você a entrar em ${groupName}`,
  textForGroupInvitationAccepted: ({ actor, groupName }) => `${actor.get('name')} aceitou seu convite para entrar em ${groupName}`,
  textForGroupPeerGroupInvite: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} convidou seu grupo ${toGroup.get('name')} a formar uma relação de pares com ${fromGroup.get('name')}`,
  textForGroupPeerGroupInviteAccepted: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} aceitou a relação de pares entre ${fromGroup.get('name')} e ${toGroup.get('name')}`,
  textForJoinRequest: ({ actor, groupName }) => `${actor.get('name')} pediu para entrar em ${groupName}`,
  textForMemberJoinedGroup: ({ group, actor }) => `Novo membro entrou em ${group.get('name')}: ${actor.get('name')}`,
  textForPostMention: ({ groupName, person, postName }) => `${person} mencionou você na publicação “${postName}” em ${groupName}`,
  textForPost: ({ firstTag, groupName, person, postName }) => `${person} publicou “${postName}” em ${groupName}${firstTag ? ` #${firstTag}` : ''}`,
  textForTrackCompleted: ({ actor, track }) => `Trilha concluída: “${track.get('name')}” foi concluída por ${actor.get('name')}`,
  textForTrackEnrollment: ({ actor, track }) => `Inscrição na trilha: “${track.get('name')}” por ${actor.get('name')}`,
  textForVoteReset: ({ person, postName, groupName }) => `${person} alterou as opções da proposta: “${postName}” em ${groupName}. Os votos foram zerados`,
  textForFundingRoundNewSubmission: ({ fundingRound, post, actor }) => `${actor.get('name')} enviou “${post.summary()}” para “${fundingRound.get('title')}”`,
  textForFundingRoundPhaseTransition: ({ fundingRound, phase }) => {
    const phaseMessages = {
      submissions: 'As inscrições estão abertas',
      discussion: 'As inscrições encerraram e as discussões estão abertas',
      voting: 'A votação está aberta',
      completed: 'A votação encerrou e a rodada terminou'
    }
    return `${fundingRound.get('title')}: ${phaseMessages[phase] || 'Status atualizado'}`
  },
  textForFundingRoundReminder: ({ reminderType }) => {
    const reminderMessages = {
      submissionsClosing1Day: 'As inscrições fecham em 1 dia',
      submissionsClosing3Days: 'As inscrições fecham em 3 dias',
      votingClosing1Day: 'A votação encerra em 1 dia',
      votingClosing3Days: 'A votação encerra em 3 dias'
    }
    return `${reminderMessages[reminderType] || 'Prazo se aproximando'}`
  },
  theTeamAtHylo: 'A equipe Hylo',
  donationTaxReceiptInfo: () => '',
  donationImpactMessage: () => 'Sua contribuição ajuda a sustentar a plataforma Hylo e nossa missão de permitir melhor coordenação e colaboração em comunidades no mundo todo.',
  donationRecurringImpactMessage: () => 'Sua contribuição recorrente ajuda a sustentar a plataforma Hylo e nossa missão de permitir melhor coordenação e colaboração em comunidades no mundo todo.'
}
