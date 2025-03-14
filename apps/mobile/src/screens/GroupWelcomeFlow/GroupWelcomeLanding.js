import React, { useEffect, useState } from 'react'
import { Text, View, ImageBackground, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { gql, useMutation } from 'urql'
import { isEmpty, trim } from 'lodash'
import FastImage from 'react-native-fast-image'
import CheckBox from 'react-native-bouncy-checkbox'
import KeyboardManager, { PreviousNextView } from 'react-native-keyboard-manager'
import updateMembershipMutation from '@hylo/graphql/mutations/updateMembershipMutation'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { useChangeToGroup } from 'hooks/useHandleCurrentGroup'
import {
  getRouteNames,
  useGroupWelcomeStore,
  GROUP_WELCOME_AGREEMENTS,
  GROUP_WELCOME_JOIN_QUESTIONS,
  GROUP_WELCOME_SUGGESTED_SKILLS
} from 'screens/GroupWelcomeFlow/GroupWelcomeFlow.store'
import GroupWelcomeTabBar from 'screens/GroupWelcomeFlow/GroupWelcomeTabBar'
import HyloHTML from 'components/HyloHTML'
import Pill from 'components/Pill'
import styles from 'screens/GroupWelcomeFlow/GroupWelcomeFlow.styles'
import { caribbeanGreen } from 'style/colors'

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
export default function GroupWelcomeLanding () {
  const { t } = useTranslation()
  const changeToGroup = useChangeToGroup()
  const [, addSkill] = useMutation(addSkillMutation)
  const [, removeSkill] = useMutation(removeSkillMutation)
  const [, updateMembershipSettings] = useMutation(updateMembershipMutation)
  const { currentStepIndex } = useGroupWelcomeStore()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  const currentMemberships = currentUser?.memberships
  const currentMembership = currentMemberships.find(m => m.group.id === currentGroup?.id)
  const routeNames = getRouteNames(currentGroup, currentMembership)

  const { name, avatarUrl, purpose, bannerUrl, description, agreements, joinQuestions, settings, welcomePage } = currentGroup
  const { agreementsAcceptedAt, joinQuestionsAnsweredAt } = currentMembership?.settings || {}
  const imageSource = { uri: avatarUrl }
  const bgImageSource = { uri: bannerUrl }

  // Agreements logic
  const numAgreements = agreements?.items?.length || 0
  const [acceptedAgreements, setAcceptedAgreements] = useState(Array(numAgreements).fill(false))
  const numAcceptedAgreements = acceptedAgreements.reduce((count, agreement) => count + (agreement ? 1 : 0), 0)
  const acceptedAllAgreements = numAcceptedAgreements === numAgreements
  const agreementsChanged = numAgreements > 0 &&
    (!agreementsAcceptedAt || agreementsAcceptedAt < currentGroup.settings.agreementsLastUpdatedAt)

  // Join Questions logic
  const [questionAnswers, setQuestionAnswers] = useState(
    joinQuestions?.items && joinQuestions.items.map(q => { return { questionId: q.questionId, text: q.text, answer: '' } })
  )
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(!currentGroup?.settings?.askJoinQuestions || !!joinQuestionsAnsweredAt)

  useEffect(() => {
    KeyboardManager.setEnable(true)
    return () => {
      KeyboardManager.setEnable(false)
    }
  }, [])

  useEffect(() => {
    if (numAgreements > 0) {
      setAcceptedAgreements(currentGroup?.agreements && currentGroup.agreements.items.map(a => a.accepted))
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
        lastViewedAt: (new Date()).toISOString(),
        questionAnswers: questionAnswers
          ? questionAnswers.map(q => ({ questionId: q.questionId, answer: q.answer }))
          : [],
        settings: {
          joinQuestionsAnsweredAt: new Date(),
          showJoinForm: false
        }
      }
    })

    changeToGroup(currentGroup.slug, { navigateHome: true, skipCanViewCheck: true })
    return null
  }

  if (!currentGroup || currentGroup?.isStaticContext) return null

  return (
    <PreviousNextView style={styles.container}>
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
          {currentStepIndex === 0 && (
            <LandingBodyContent
              welcomePage={settings?.showWelcomePage && welcomePage}
              description={description}
              purpose={purpose}
              currentStepIndex={currentStepIndex}
            />
          )}
          {routeNames[currentStepIndex] === GROUP_WELCOME_AGREEMENTS && (
            <AgreementsBodyContent
              agreements={agreements.items}
              agreementsChanged={agreementsChanged}
              acceptedAgreements={acceptedAgreements}
              handleCheckAgreement={handleCheckAgreement}
              acceptedAllAgreements={acceptedAllAgreements}
              handleCheckAllAgreements={handleCheckAllAgreements}
              numAgreements={numAgreements}
            />
          )}
          {routeNames[currentStepIndex] === GROUP_WELCOME_JOIN_QUESTIONS && (
            <JoinQuestionsBodyContent
              questionAnswers={questionAnswers}
              setQuestionAnswers={setQuestionAnswers}
              setAllQuestionsAnswered={setAllQuestionsAnswered}
            />
          )}
          {routeNames[currentStepIndex] === GROUP_WELCOME_SUGGESTED_SKILLS && (
            <SuggestedSkills
              addSkill={addSkill}
              currentUser={currentUser}
              group={currentGroup}
              removeSkill={removeSkill}
            />
          )}
        </View>
      </ScrollView>
      <GroupWelcomeTabBar
        group={currentGroup}
        agreements={agreements.items}
        acceptedAllAgreements={acceptedAllAgreements}
        handleAccept={handleAccept}
        allQuestionsAnswered={allQuestionsAnswered}
      />
    </PreviousNextView>
  )
}

function LandingBodyContent ({ description, purpose, welcomePage }) {
  const { t } = useTranslation()
  const backupText = t('welcome page backup text')
  return (
    <>
      {welcomePage &&
        <View style={{ flexDirection: 'column', justifyContent: 'center' }}>
          <HyloHTML html={welcomePage} />
        </View>}
      {!isEmpty(purpose) &&
        <View style={{ flexDirection: 'column', justifyContent: 'center' }}>
          <Text style={styles.sectionHeading}>{t('Our Purpose')}:</Text>
          <Text style={styles.purposeText}>{purpose}</Text>
        </View>}
      {!isEmpty(description) &&
        <View style={{ flexDirection: 'column', justifyContent: 'center' }}>
          <Text style={styles.sectionHeading}>{t('Description')}:</Text>
          <HyloHTML html={description} />
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
          const isSelected = selectedSkills.includes(pill.id)
          return (
            <Pill
              key={pill.id}
              id={pill.id}
              label={pill.label}
              style={{ borderRadius: 15, borderWidth: 1, padding: 6, margin: 5 }}
              textClasses={isSelected ? 'text-secondary' : 'text-foreground'}
              onPress={() => handlePress(pill.id)}
            />
          )
        })}
      </View>
    </View>
  )
}
