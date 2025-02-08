import React, { useEffect, useState } from 'react'
import { isEmpty, trim } from 'lodash'
import { useSelector } from 'react-redux'
import { gql, useMutation } from 'urql'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import FastImage from 'react-native-fast-image'
import { Text, View, ImageBackground, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import CheckBox from 'react-native-bouncy-checkbox'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { DEFAULT_AVATAR, DEFAULT_BANNER } from '@hylo/presenters/GroupPresenter'
import {
  GROUP_WELCOME_AGREEMENTS,
  GROUP_WELCOME_JOIN_QUESTIONS,
  GROUP_WELCOME_SUGGESTED_SKILLS,
  getCurrentStepIndex,
  getRouteNames
} from './GroupWelcomeFlow.store'
import Pill from 'components/Pill'
import GroupWelcomeTabBar from './GroupWelcomeTabBar'
import { caribbeanGreen, rhino } from 'style/colors'
import styles from './GroupWelcomeFlow.styles'

export const addSkillMutation = gql`
  mutation AddSkillMutation ($name: String) {
    addSkill(name: $name) {
      id,
      name
    }
  }
`

export const removeSkillMutation = gql`
  mutation RemoveSkillMutation ($id: ID) {
    removeSkill(id: $id) {
      success
    }
  }
`

export const updateMembershipMutation = gql`
  mutation UpdateMembershipMutation ($groupId: ID, $data: MembershipInput) {
    updateMembership(groupId: $groupId, data: $data) {
      id
    }
  }
`

export default function GroupWelcomeLanding ({ route }) {
  const { t } = useTranslation()
  const [, addSkill] = useMutation(addSkillMutation)
  const [, removeSkill] = useMutation(removeSkillMutation)
  const [, updateMembershipSettings] = useMutation(updateMembershipMutation)
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  // TODO redesign: there are instances where this can be rendered and then the groupSlug is changed to a contextGroup and this explodes. Need to address this
  // TODO redesign: this also gets weird when you switch groups; the selected group renders the Group Welcome, even if you've already done that for that group
  const [{ currentGroup }] = useCurrentGroup()
  const currentStepIndex = useSelector(getCurrentStepIndex)
  const currentMemberships = currentUser?.memberships
  const currentMembership = currentMemberships.find(m => m.group.id === currentGroup?.id)
  const routeNames = getRouteNames(currentGroup, currentMembership)

  const { name, avatarUrl, purpose, bannerUrl, description, agreements, joinQuestions } = currentGroup
  const { agreementsAcceptedAt, joinQuestionsAnsweredAt,showJoinForm } = currentMembership?.settings || {}
  const imageSource = { uri: avatarUrl || DEFAULT_AVATAR }
  const bgImageSource = { uri: bannerUrl || DEFAULT_BANNER }

  // Agreements logic
  const numAgreements = agreements?.length || 0
  const [acceptedAgreements, setAcceptedAgreements] = useState(Array(numAgreements).fill(false))
  const numAcceptedAgreements = acceptedAgreements.reduce((count, agreement) => count + (agreement ? 1 : 0), 0)
  const acceptedAllAgreements = numAcceptedAgreements === numAgreements
  const agreementsChanged = numAgreements > 0 &&
    (!agreementsAcceptedAt || agreementsAcceptedAt < currentGroup.settings.agreementsLastUpdatedAt)

  // Join Questions logic
  const [questionAnswers, setQuestionAnswers] = useState(joinQuestions.items.map(q => { return { questionId: q.questionId, text: q.text, answer: '' } }))
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(!currentGroup?.settings?.askJoinQuestions || !!joinQuestionsAnsweredAt)

  useEffect(() => {
    if (!showJoinForm &&
      !agreementsChanged &&
      (joinQuestionsAnsweredAt ||
      !currentGroup?.settings?.askJoinQuestions)) {
      // TODO: Should use useChangeToGroup hook, or simply navigate to Stream because this is already the currentGroup
      navigation.navigate('Stream', { groupId: currentGroup?.id, initial: false })
    }
  }, [showJoinForm, agreementsChanged, joinQuestionsAnsweredAt])

  useEffect(() => {
    if (numAgreements > 0) {
      setAcceptedAgreements(currentGroup.agreements.items.map(a => a.accepted))
    }
  }, [currentGroup?.id])

  const handleCheckAgreement = ({ checked, index }) => {
    const accepted = checked
    const agreementIndex = index
    const newAgreements = [...acceptedAgreements]
    newAgreements[agreementIndex] = accepted
    setAcceptedAgreements(newAgreements)
  }

  const handleCheckAllAgreements = e => {
    const accepted = !acceptedAllAgreements
    const newAgreements = Array(numAgreements).fill(accepted)
    setAcceptedAgreements(newAgreements)
  }

  const handleAccept = async () => {
    await updateMembershipSettings({
      groupId: currentGroup?.id,
      data: {
        acceptAgreements: true,
        questionAnswers: questionAnswers
          ? questionAnswers.map(q => ({ questionId: q.questionId, answer: q.answer }))
          : [],
        settings: {
          joinQuestionsAnsweredAt: new Date(),
          showJoinForm: false
        }
      }
    })
    navigation.goBack()
    return null
  }

  return (
    <View style={styles.container}>
      <ScrollView
        keyboardDismissMode='on-drag'
        keyboardShouldPersistTaps='handled'
        style={{
          flex: 1,
          width: '100%',
          marginTop: 12,
          marginBottom: 12,
          gap: 4
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <ImageBackground source={bgImageSource} style={[styles.bannerBackground, styles.columnStyling]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <View style={styles.avatarContainer}>
                <FastImage source={imageSource} style={styles.groupAvatar} />
              </View>
              <Text style={styles.heading}>{t('Welcome to')}:</Text>
            </View>
            <Text style={[styles.heading]}>{name}</Text>
          </ImageBackground>
        </View>
        <View style={{ flex: 1, gap: 6, paddingLeft: 16, paddingRight: 16 }}>
          {currentStepIndex === 0 && <LandingBodyContent description={description} purpose={purpose} currentStepIndex={currentStepIndex} />}
          {routeNames[currentStepIndex] === GROUP_WELCOME_AGREEMENTS && <AgreementsBodyContent agreements={agreements} agreementsChanged={agreementsChanged} acceptedAgreements={acceptedAgreements} handleCheckAgreement={handleCheckAgreement} acceptedAllAgreements={acceptedAllAgreements} handleCheckAllAgreements={handleCheckAllAgreements} numAgreements={numAgreements} />}
          {routeNames[currentStepIndex] === GROUP_WELCOME_JOIN_QUESTIONS && <JoinQuestionsBodyContent questionAnswers={questionAnswers} setQuestionAnswers={setQuestionAnswers} setAllQuestionsAnswered={setAllQuestionsAnswered} />}
          {routeNames[currentStepIndex] === GROUP_WELCOME_SUGGESTED_SKILLS && <SuggestedSkills addSkill={addSkill} currentUser={currentUser} group={currentGroup} removeSkill={removeSkill} />}
        </View>
      </ScrollView>
      <GroupWelcomeTabBar group={currentGroup} agreements={agreements} acceptedAllAgreements={acceptedAllAgreements} handleAccept={handleAccept} allQuestionsAnswered={allQuestionsAnswered} />
    </View>
  )
}

function LandingBodyContent ({ description, purpose }) {
  const { t } = useTranslation()
  const backupText = t('welcome page backup text')

  return (
    <>
      {!isEmpty(purpose) &&
        <View style={{ flexDirection: 'column', justifyContent: 'center' }}>
          <Text style={styles.sectionHeading}>{t('Our Purpose')}:</Text>
          <Text style={styles.purposeText}>{purpose}</Text>
        </View>}
      {!isEmpty(description) &&
        <View style={{ flexDirection: 'column', justifyContent: 'center' }}>
          <Text style={styles.sectionHeading}>{t('Description')}:</Text>
          <Text style={styles.purposeText}>{description}</Text>
        </View>}
      {isEmpty(description) && isEmpty(purpose) &&
        <View style={{ flexDirection: 'column', justifyContent: 'center' }}>
          <Text style={styles.sectionHeading}>{t('Were happy youre here')}</Text>
          <Text style={styles.purposeText}>{backupText}</Text>
        </View>}
    </>
  )
}

function AgreementsBodyContent ({ agreements, acceptedAgreements, handleCheckAgreement, acceptedAllAgreements, handleCheckAllAgreements, numAgreements }) {
  const { t } = useTranslation()
  return (
    <View style={{ width: '90%' }}>
      <Text style={styles.sectionHeading}>{t('Our Agreements')}:</Text>
      {agreements.map((agreement, index) => (
        <View key={index} style={styles.agreementListItem}>
          <Text style={styles.listNumber}>{index + 1}.</Text>
          <View style={{ display: 'flex', gap: 4 }}>
            <Text style={styles.agreementTitle}>{agreement.title}</Text>
            <Text style={styles.agreementText}>{agreement.description}</Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'baseline', gap: 6 }}
            >
              <CheckBox
                size={20}
                fillColor={caribbeanGreen}
                isChecked={acceptedAgreements[index] || acceptedAllAgreements}
                onPress={() => handleCheckAgreement({ index, checked: !acceptedAgreements[index] })}
                disableBuiltInState
              />
              <TouchableOpacity onPress={() => handleCheckAgreement({ index, checked: !acceptedAgreements[index] })}>
                <Text style={(acceptedAgreements[index] || acceptedAllAgreements) ? styles.agreementAccepted : styles.acceptanceText}>{t('I agree to the above')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}
      {numAgreements >= 3 && (
        <TouchableOpacity
          onPress={handleCheckAllAgreements}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'baseline', gap: 6, marginTop: 8 }}
        >
          <CheckBox
            size={20}
            fillColor={caribbeanGreen}
            isChecked={acceptedAllAgreements}
            onPress={handleCheckAllAgreements}
            disableBuiltInState
          />
          <Text style={acceptedAgreements ? styles.agreementAccepted : styles.acceptanceText}>{t('Accept all agreements')}</Text>
        </TouchableOpacity>)}
    </View>
  )
}

function JoinQuestionsBodyContent ({ questionAnswers, setQuestionAnswers, setAllQuestionsAnswered }) {
  const { t } = useTranslation()
  const setAnswer = ({ value, index }) => {
    const newAnswers = [...questionAnswers]
    newAnswers[index].answer = value
    setQuestionAnswers(newAnswers)
  }

  useEffect(() => {
    setAllQuestionsAnswered(questionAnswers.every(a => trim(a.answer).length > 0))
  }, [questionAnswers])

  return (
    <View style={{ width: '90%' }}>
      <Text style={styles.sectionHeading}>{t('Join Questions')}:</Text>
      {questionAnswers.map((question, index) => (
        <React.Fragment key={question.questionId}>
          <View key={index} style={styles.agreementListItem}>
            <Text style={styles.listNumber}>{index + 1}.</Text>
            <Text style={styles.agreementText}>{question.text}</Text>
          </View>
          <TextInput
            style={styles.textInput}
            onChangeText={(value) => setAnswer({ value, index })}
            returnKeyType='next'
            autoCapitalize='none'
            value={question.answer}
            autoCorrect={false}
            underlineColorAndroid='transparent'
            maxLength={500}
            multiline
          />
        </React.Fragment>
      ))}
    </View>
  )
}

function SuggestedSkills ({ addSkill, currentUser, group, removeSkill }) {
  const { t } = useTranslation()
  const [selectedSkills, setSelectedSkills] = useState(currentUser.skills ? currentUser?.skills?.items.map(s => s.id) : [])
  const [pills] = useState(group.suggestedSkills.items.map(skill => ({
    ...skill,
    label: skill.name
  })))

  const handlePress = (skillId) => {
    const hasSkill = selectedSkills.includes(skillId)
    if (hasSkill) {
      removeSkill({ id: skillId })
      setSelectedSkills(selectedSkills.filter(s => s !== skillId))
    } else {
      addSkill({ name: group.suggestedSkills.items.find(s => s.id === skillId).name })
      setSelectedSkills(selectedSkills.concat(skillId))
    }
  }

  return (
    <View style={styles.joinQuestions}>
      <Text>{t('Which of the following skills & interests are relevant to you')}</Text>
      <View style={styles.skillPills}>
        {pills && pills.map(pill => {
          const color = selectedSkills.includes(pill.id) ? caribbeanGreen : rhino
          return (
            <Pill
              key={pill.id}
              id={pill.id}
              label={pill.label}
              style={{ borderRadius: 15, borderWidth: 1, borderColor: color, padding: 6, margin: 5 }}
              displayColor={color}
              onPress={() => handlePress(pill.id)}
            />
          )
        })}
      </View>
    </View>
  )
}
