import React from 'react'
import { useTranslation } from 'react-i18next'
import { View, Text, Platform } from 'react-native'
import { PROPOSAL_STATUS_COMPLETED } from '@hylo/presenters/PostPresenter'

const QuorumBar = ({ totalVoters, quorum, actualVoters, proposalStatus }) => {
  const { t } = useTranslation()
  const votersForQuorum = Math.ceil((quorum / 100) * totalVoters)
  const actualVotersWidth = (actualVoters / totalVoters) * 100
  const quorumReached = actualVoters >= votersForQuorum

  let quorumStatus = quorumReached ? t('Quorum reached') : t('Quorum')
  if (proposalStatus === PROPOSAL_STATUS_COMPLETED && !quorumReached) quorumStatus = t('Quorum not reached')
  const bigQuorum = quorum > 75
  return (
    <View style={styles.voteProgressContainer}>
      <View style={[styles.actualVoters, { width: `${actualVotersWidth}%` }]}>
        {quorum > 10 && <Text style={styles.quorumText}>{quorumStatus}</Text>}
      </View>
      <View style={[styles.quorumBar, { width: `${quorum}%` }]}>
        <Text style={[styles.quorumNumber, bigQuorum && styles.bigQuorum, quorumReached && styles.quorumReached]}>{quorum}%: {actualVoters || 0}/{votersForQuorum}</Text>
      </View>
      <View style={styles.totalVotersBar} />
    </View>
  )
}
const styles = {
  voteProgressContainer: {
    position: 'relative',
    height: 16,
    width: '100%',
    backgroundColor: '#C0C5CD75',
    borderRadius: 5
  },
  votersBar: {
    position: 'relative',
    height: '100%',
    width: '100%'
  },
  totalVotersBar: {
    position: 'absolute',
    height: '100%',
    zIndex: 1,
    borderRadius: 5,
    backgroundColor: '#C0C5CD75'
  },
  actualVoters: {
    position: 'absolute',
    height: '100%',
    zIndex: 3,
    borderRadius: 5,
    backgroundColor: '#0074D8'
  },
  quorumBar: {
    position: 'absolute',
    borderRadius: 5,
    height: '100%',
    zIndex: 2,
    backgroundColor: '#808C9B'
  },
  quorumText: {
    position: 'absolute',
    textTransform: 'uppercase',
    top: Platform.OS === 'ios' ? 2 : 1,
    left: 8,
    color: 'white',
    fontSize: 10,
    width: 200
  },
  quorumNumber: {
    position: 'absolute',
    textTransform: 'uppercase',
    top: Platform.OS === 'ios' ? 0 : -1,
    color: 'red',
    fontSize: 12,
    right: -80
  },
  bigQuorum: {
    right: 12,
    color: 'white',
    fontSize: 12
  },
  quorumReached: {
    color: '#0074D8'
  }
}

export default QuorumBar
