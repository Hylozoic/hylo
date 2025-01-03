import React, { useCallback, useEffect, useState } from 'react'
import { isEmpty, trim } from 'lodash'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigation } from '@react-navigation/native'
import FastImage from 'react-native-fast-image'
import { Text, View, ImageBackground, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import CheckBox from 'react-native-bouncy-checkbox'
import presentGroup from 'store/presenters/presentGroup'
import getGroup from 'store/selectors/getGroup'
import { updateMembershipSettings } from 'store/actions/updateMembershipSettings'
import { addSkill as addSkillAction, removeSkill as removeSkillAction } from 'store/actions/skills'
import { DEFAULT_AVATAR, DEFAULT_BANNER } from 'store/models/Group'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getMe from 'store/selectors/getMe'
import styles from './GroupWelcomeFlow.styles'
import GroupWelcomeTabBar from './GroupWelcomeTabBar'
import { caribbeanGreen, rhino } from 'style/colors'
import Pill from 'components/Pill'
import { GROUP_WELCOME_AGREEMENTS, GROUP_WELCOME_JOIN_QUESTIONS, GROUP_WELCOME_SUGGESTED_SKILLS, getCurrentStepIndex, getRouteNames } from './GroupWelcomeFlow.store'
import { useTranslation } from 'react-i18next'

export default function GroupWelcomeLanding ({ route }) {
  const { t } = useTranslation()
  const { params } = route
  const { groupId } = params
  const dispatch = useDispatch()
  const navigation = useNavigation()
  const currentGroup = useSelector(state => getGroup(state, { id: groupId }))
  const group = presentGroup(currentGroup)
  const currentStepIndex = useSelector(getCurrentStepIndex)
  const currentUser = useSelector(getMe)
  const currentMemberships = useSelector(state => getMyMemberships(state))
  const currentMembership = currentMemberships.find(m => m.group.id === groupId)
  const routeNames = getRouteNames(group, currentMembership)
  const addSkill = name => dispatch(addSkillAction(name))
  const removeSkill = skillId => dispatch(removeSkillAction(skillId))

  const { name, avatarUrl, purpose, bannerUrl, description, agreements, joinQuestions } = group
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
  const [questionAnswers, setQuestionAnswers] = useState(joinQuestions.map(q => { return { questionId: q.questionId, text: q.text, answer: '' } }))
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(!group?.settings?.askJoinQuestions || !!joinQuestionsAnsweredAt)

  useEffect(() => {
    if (!showJoinForm &&
      !agreementsChanged &&
      (joinQuestionsAnsweredAt ||
      !group.settings?.askJoinQuestions)) {
      navigation.navigate('Stream', { groupId, initial: false })
    }
  }, [showJoinForm, agreementsChanged, joinQuestionsAnsweredAt])

  useEffect(() => {
    if (numAgreements > 0) {
      setAcceptedAgreements(group.agreements.map(a => a.accepted))
    }
  }, [group?.id])

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
    await dispatch(updateMembershipSettings(
      group.id,
      { joinQuestionsAnsweredAt: new Date(), showJoinForm: false },
      true,
      questionAnswers ? questionAnswers.map(q => ({ questionId: q.questionId, answer: q.answer })) : []
    )).then(() => navigation.goBack())
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
          {routeNames[currentStepIndex] === GROUP_WELCOME_SUGGESTED_SKILLS && <SuggestedSkills addSkill={addSkill} currentUser={currentUser} group={group} removeSkill={removeSkill} />}
        </View>
      </ScrollView>
      <GroupWelcomeTabBar group={group} agreements={agreements} acceptedAllAgreements={acceptedAllAgreements} handleAccept={handleAccept} allQuestionsAnswered={allQuestionsAnswered} />
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
  const [selectedSkills, setSelectedSkills] = useState(currentUser.skills ? currentUser.skills.toRefArray().map(s => s.id) : [])
  const [pills, setPills] = useState(group.suggestedSkills.map(skill => ({
    ...skill,
    label: skill.name
  })))

  const handlePress = (skillId) => {
    const hasSkill = selectedSkills.includes(skillId)
    if (hasSkill) {
      removeSkill(skillId)
      setSelectedSkills(selectedSkills.filter(s => s !== skillId))
    } else {
      addSkill(group.suggestedSkills.find(s => s.id === skillId).name)
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
