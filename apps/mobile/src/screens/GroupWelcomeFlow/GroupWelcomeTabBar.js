import React, { useState } from 'react'
import { View, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import isEmpty from 'lodash/isEmpty'
import { MY_CONTEXT_SLUG } from '@hylo/shared'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useOpenURL from 'hooks/useOpenURL'
import { isIOS } from 'util/platform'
import {
  getRouteNames,
  useGroupWelcomeStore,
  GROUP_WELCOME_AGREEMENTS,
  GROUP_WELCOME_JOIN_QUESTIONS
} from 'screens/GroupWelcomeFlow/GroupWelcomeFlow.store'
import Button from 'components/Button'
import { caribbeanGreen, rhino30, white, white20onCaribbeanGreen, white40onCaribbeanGreen } from 'style/colors'

export default function GroupWelcomeTabBar ({
  acceptedAllAgreements,
  agreements,
  handleAccept,
  allQuestionsAnswered
}) {
  const { t } = useTranslation()
  const openURL = useOpenURL()

  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup: group }] = useCurrentGroup()
  const { currentStepIndex, decrementCurrentStepIndex, incrementCurrentStepIndex } = useGroupWelcomeStore()
  const currentMemberships = currentUser?.memberships
  const currentMembership = currentMemberships && currentMemberships.find(m => m.group.id === group.id)

  const routeNames = getRouteNames(group, currentMembership)
  const prevStepScreenName = routeNames[currentStepIndex - 1]
  const nextStepScreenName = routeNames[currentStepIndex + 1]
  const currentStepName = routeNames[currentStepIndex]

  const [completeButtonDisabled, setCompleteButtonDisabled] = useState(false)

  const onAgreementStepButNotReady = currentStepName === GROUP_WELCOME_AGREEMENTS && !acceptedAllAgreements
  const onJoinQuestionStepButNotReady = currentStepName === GROUP_WELCOME_JOIN_QUESTIONS && !allQuestionsAnswered

  const handleBackOut = async () => {
    const enforceAgreements = !isEmpty(agreements)
    let explainerText = t('There are still some required steps before you can view group contents')
    if (onAgreementStepButNotReady) {
      explainerText = t('To view the group contents, you have to adhere to the group agreements')
    }
    if (onJoinQuestionStepButNotReady) {
      explainerText = t('Please answer all the join questions to continue')
    }
    const getOutTitle = enforceAgreements ? t('Exit this Group & Return Home') : t('Skip')
    const getOutFunc = enforceAgreements
      ? () => openURL(`/groups/${MY_CONTEXT_SLUG}`, { replace: true })
      : () => completeWorkflow()
    Alert.alert(
      t('Are you sure you want to leave the Group Welcome?'),
      explainerText,
      [
        {
          text: t('Return to Group Welcome'),
          onPress: () => {} // noop that closes alert
        },
        {
          text: getOutTitle,
          onPress: getOutFunc
        }
      ],
      { cancelable: false }
    )
  }

  const gotoPrevStep = () => {
    // TODO: is this even useful still?
    setCompleteButtonDisabled(false)
    decrementCurrentStepIndex()
  }

  const gotoNextStep = () => {
    incrementCurrentStepIndex()
  }

  const completeWorkflow = () => {
    handleAccept()
    setCompleteButtonDisabled(true)
  }

  return (
    <View style={[styles.container]}>
      {nextStepScreenName && (
        <Button
          text={t('Exit')}
          onPress={handleBackOut}
          style={styles.backButton}
        />
      )}
      {prevStepScreenName && (
        <Button
          text={t('< Back')}
          onPress={gotoPrevStep}
          style={styles.backButton}
        />
      )}
      {nextStepScreenName && (
        <Button
          text={t('Continue')}
          onPress={(onAgreementStepButNotReady || onJoinQuestionStepButNotReady) ? handleBackOut : gotoNextStep}
          style={styles.continueButton}
        />
      )}
      {!nextStepScreenName && (
        <Button
          text={t('Lets Do This!')}
          onPress={(onAgreementStepButNotReady || onJoinQuestionStepButNotReady) ? handleBackOut : completeWorkflow}
          disabled={completeButtonDisabled || onAgreementStepButNotReady || onJoinQuestionStepButNotReady}
          style={styles.continueButton}
        />
      )}
    </View>
  )
}

const buttonStyle = {
  height: 40,
  fontSize: 16,
  paddingBottom: isIOS ? 30 : 10
}

const styles = {
  container: {
    backgroundColor: white20onCaribbeanGreen,
    paddingTop: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  backButton: {
    ...buttonStyle,
    width: 80,
    color: white,
    backgroundColor: white40onCaribbeanGreen,
    marginRight: 8
  },
  continueButton: {
    ...buttonStyle,
    width: 134,
    marginLeft: 'auto',
    color: caribbeanGreen,
    backgroundColor: white,
    disabledColor: white,
    disabledBackgroundColor: rhino30
  }
}
