exports.hi = {
  apiInviteMessageContent: (name) => `${name} आपको Hylo पर हमारे समुदाय में शामिल होने के लिए आमंत्रित करते हुए खुश हैं।`,
  apiInviteMessageSubject: (name) => `Hylo पर ${name} में मेरे साथ जुड़ें!`,
  clientInviteSubjectDefault: (name) => `आपको Hylo पर ${name} में शामिल होने के लिए आमंत्रित किया गया है`,
  clientInviteMessageDefault: ({ userName, groupName }) => `नमस्ते ${userName}, <br><br> हम आपको अपने समुदाय में स्वागत करते हुए प्रसन्न हैं। Hylo पर ${groupName} में शामिल होने के लिए नीचे क्लिक करें।`,
  CreatorEmail: () => 'निर्माता ईमेल',
  createInvitationSubject: (name) => `Hylo पर ${name} में मेरे साथ जुड़ें!`,
  CreatorName: () => 'निर्माता का नाम',
  CreatorURL: () => 'निर्माता URL',
  Group: () => 'समूह',
  emailDigestDailySubject: (name) => `आपका ${name} दैनिक सारांश`,
  emailDigestWeeklySubject: (name) => `आपका ${name} साप्ताहिक सारांश`,
  groupCreatedNotifySubject: (name) => `नया Hylo समूह बनाया गया: ${name}`,
  fundingRoundTransitionButtonText: ({ phase }) => {
    const buttonTextMessages = {
      submissions: 'अपना प्रस्तुत करें',
      discussion: 'प्रस्तुतों पर चर्चा करें',
      voting: 'राउंड में वोट करें',
      completed: 'परिणाम देखें',
      viewRound: 'राउंड देखें'
    }
    return buttonTextMessages[phase] || 'राउंड देखें'
  },
  fundingRoundTransitionText: ({ phase }) => {
    const transitionTextMessages = {
      submissions: 'प्रस्तुत अब खुले हैं',
      discussion: 'प्रस्तुत अब बंद हैं',
      voting: 'मतदान अब खुला है',
      completed: 'मतदान अब बंद है'
    }
    return transitionTextMessages[phase] || 'स्थिति अपडेट की गई'
  },
  moderationClearedFlagFromYourPost: () => 'मॉडरेटर ने आपकी पोस्ट से एक रिपोर्ट हटा दी',
  moderationClearedPostEmailContent: ({ post, group }) => `समूह ${group.get('name')} में आपकी पोस्ट "${post.summary()}" को समूह समझौते के उल्लंघन से मुक्त कर दिया गया। \n`,
  moderationClearedYourFlag: () => 'मॉडरेटर ने आपकी रिपोर्ट हटा दी',
  moderationFlaggedPostEmailContent: ({ post, group }) => `समूह ${group.get('name')} में आपकी पोस्ट "${post.summary()}" को समूह समझौते का उल्लंघन बताकर रिपोर्ट किया गया। \n`,
  moderationReporterClearedPostEmailContent: ({ post, group }) => `समूह ${group.get('name')} में वह पोस्ट "${post.summary()}" जिसे आपने रिपोर्ट किया था, समूह समझौते के उल्लंघन से मुक्त कर दी गई। \n`,
  moderationYouFlaggedAPost: () => 'आपने एक पोस्ट रिपोर्ट की',
  moderationYouFlaggedPostEmailContent: ({ post, group }) => `आपने समूह ${group.get('name')} में पोस्ट "${post.summary()}" को समूह समझौते का उल्लंघन बताकर रिपोर्ट किया। \n`,
  moderationYourPostWasFlagged: () => 'आपकी पोस्ट रिपोर्ट की गई',
  Name: () => 'नाम',
  newSavedSearchResults: (name) => `${name} में सहेजी खोज के नए परिणाम`,
  textForApprovedJoinRequest: ({ actor, groupName }) => `${actor.get('name')} ने ${groupName} में शामिल होने के आपके अनुरोध को मंजूर किया`,
  textForAnnouncement: ({ person, postName, groupName }) => `${person} ने ${groupName} को घोषणा "${postName}" भेजी`,
  textForChatPost: ({ firstTag, groupName, person, postName }) => `${person} ने ${groupName} में चैट "${postName}" की${firstTag ? ` #${firstTag}` : ''}`,
  textForCommentImage: person => `${person} ने एक छवि भेजी`,
  textForCommentMention: ({ person, blurb, postName }) => `${person} ने आपका उल्लेख किया: "${blurb}" ("${postName}" में)`,
  textForComment: ({ person, blurb, postName }) => `${person}: "${blurb}" ("${postName}" में)`,
  textForContribution: post => `आपको अनुरोध "${post.summary()}" में योगदानकर्ता के रूप में जोड़ा गया है`,
  textForDonationTo: ({ amount, postName }) => `आपने "${postName}" में $${amount} योगदान दिया`,
  textForDonationFrom: ({ amount, actor, postName }) => `${actor.get('name')} ने "${postName}" में $${amount} योगदान दिया`,
  textForGroupChildGroupInvite: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} ने आपके समूह ${childGroup.get('name')} को अपने समूह ${parentGroup.get('name')} में शामिल होने के लिए आमंत्रित किया`,
  textForGroupChildGroupInviteAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} ने आपके निमंत्रण को स्वीकार किया कि उनका समूह ${childGroup.get('name')} आपके समूह ${parentGroup.get('name')} में शामिल हो`,
  textForGroupChildGroupInviteAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} ने आपके निमंत्रण को स्वीकार किया कि आपका समूह ${childGroup.get('name')} उनके समूह ${parentGroup.get('name')} में शामिल हो`,
  textForGroupChildGroupInviteAcceptedParentMember: ({ parentGroup, childGroup }) => `समूह ${childGroup.get('name')} अभी आपके समूह ${parentGroup.get('name')} में शामिल हुआ!`,
  textForGroupChildGroupInviteAcceptedChildMember: ({ parentGroup, childGroup }) => `आपका समूह ${childGroup.get('name')} ${parentGroup.get('name')} में शामिल हो गया। अब आप ${parentGroup.get('name')} में शामिल हो सकते हैं!`,
  textForGroupParentGroupJoinRequest: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} अपने समूह ${childGroup.get('name')} को आपके समूह ${parentGroup.get('name')} का सदस्य बनाने का अनुरोध कर रहे हैं`,
  textForGroupParentGroupJoinRequestAcceptedParentModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} ने ${childGroup.get('name')} को आपके समूह ${parentGroup.get('name')} में जोड़ने का अनुरोध स्वीकार किया`,
  textForGroupParentGroupJoinRequestAcceptedChildModerator: ({ actor, parentGroup, childGroup }) => `${actor.get('name')} द्वारा आपका समूह ${childGroup.get('name')} ${parentGroup.get('name')} का सदस्य स्वीकार किया गया`,
  textForGroupParentGroupJoinRequestAcceptedParentMember: ({ parentGroup, childGroup }) => `समूह ${childGroup.get('name')} अभी आपके समूह ${parentGroup.get('name')} में शामिल हुआ!`,
  textForGroupParentGroupJoinRequestAcceptedChildMember: ({ parentGroup, childGroup }) => `आपका समूह ${childGroup.get('name')} ${parentGroup.get('name')} में शामिल हो गया।`,
  textForEventInvitation: ({ actor, postName }) => `${actor.get('name')} ने आपको "${postName}" के लिए आमंत्रित किया`,
  textForGroupInvitation: ({ actor, groupName }) => `${actor.get('name')} ने आपको ${groupName} में शामिल होने के लिए आमंत्रित किया`,
  textForGroupInvitationAccepted: ({ actor, groupName }) => `${actor.get('name')} ने ${groupName} में शामिल होने के आपके निमंत्रण को स्वीकार किया`,
  textForGroupPeerGroupInvite: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} ने आपके समूह ${toGroup.get('name')} को ${fromGroup.get('name')} के साथ सहकर्मी संबंध बनाने के लिए आमंत्रित किया`,
  textForGroupPeerGroupInviteAccepted: ({ actor, fromGroup, toGroup }) => `${actor.get('name')} ने ${fromGroup.get('name')} और ${toGroup.get('name')} के बीच सहकर्मी संबंध स्वीकार किया`,
  textForJoinRequest: ({ actor, groupName }) => `${actor.get('name')} ने ${groupName} में शामिल होने के लिए कहा`,
  textForMemberJoinedGroup: ({ group, actor }) => `${group.get('name')} में नया सदस्य शामिल हुआ: ${actor.get('name')}`,
  textForPostMention: ({ groupName, person, postName }) => `${person} ने ${groupName} में पोस्ट "${postName}" में आपका उल्लेख किया`,
  textForPost: ({ firstTag, groupName, person, postName }) => `${person} ने ${groupName} में "${postName}" पोस्ट की${firstTag ? ` #${firstTag}` : ''}`,
  textForTrackCompleted: ({ actor, track }) => `ट्रैक पूर्ण: "${track.get('name')}" ${actor.get('name')} द्वारा पूर्ण किया गया`,
  textForTrackEnrollment: ({ actor, track }) => `ट्रैक नामांकन: "${track.get('name')}" में ${actor.get('name')} ने नामांकन लिया`,
  textForVoteReset: ({ person, postName, groupName }) => `${person} ने ${groupName} में प्रस्ताव: "${postName}" के विकल्प बदल दिए। वोट रीसेट हो गए हैं`,
  textForFundingRoundNewSubmission: ({ fundingRound, post, actor }) => `${actor.get('name')} ने "${fundingRound.get('title')}" के लिए "${post.summary()}" जमा किया`,
  textForFundingRoundPhaseTransition: ({ fundingRound, phase }) => {
    const phaseMessages = {
      submissions: 'प्रस्तुत अब खुले हैं',
      discussion: 'प्रस्तुत बंद हो चुके हैं और चर्चाएँ खुली हैं',
      voting: 'मतदान अब खुला है',
      completed: 'मतदान बंद हो गया है और राउंड समाप्त हो गया'
    }
    return `${fundingRound.get('title')}: ${phaseMessages[phase] || 'स्थिति अपडेट की गई'}`
  },
  textForFundingRoundReminder: ({ reminderType }) => {
    const reminderMessages = {
      submissionsClosing1Day: 'प्रस्तुत 1 दिन में बंद होंगे',
      submissionsClosing3Days: 'प्रस्तुत 3 दिनों में बंद होंगे',
      votingClosing1Day: 'मतदान 1 दिन में बंद होगा',
      votingClosing3Days: 'मतदान 3 दिनों में बंद होगा'
    }
    return `${reminderMessages[reminderType] || 'समय सीमा निकट है'}`
  },
  theTeamAtHylo: 'Hylo की टीम',
  stripeContributionProductName: () => 'अपना Hylo योगदान चुनें',
  stripeContributionProductDescription: () => 'Hylo प्लेटफ़ॉर्म को सहयोग देने के लिए अपना योगदान स्तर चुनें।',
  stripeSlidingScaleUnitProductName: ({ currency }) => `अपनी योगदान राशि तय करें (${currency} इकाइयाँ)`,
  stripeSlidingScaleUnitProductDescription: () => 'अपनी योगदान राशि चुनने के लिए मात्रा समायोजित करें।',
  donationTaxReceiptInfo: () => '',
  donationImpactMessage: () => 'आपका योगदान Hylo प्लेटफ़ॉर्म और दुनिया भर के समुदायों में बेहतर समन्वय और सहयोग सक्षम करने के हमारे मिशन का समर्थन करता है।',
  donationRecurringImpactMessage: () => 'आपका आवर्ती योगदान Hylo प्लेटफ़ॉर्म और दुनिया भर के समुदायों में बेहतर समन्वय और सहयोग सक्षम करने के हमारे मिशन का समर्थन करता है।'
}
