import { useState } from 'react'
import { useMutation } from 'urql'
import joinFundingRoundMutation from '@hylo/graphql/mutations/joinFundingRoundMutation'
import leaveFundingRoundMutation from '@hylo/graphql/mutations/leaveFundingRoundMutation'

export default function useFundingRoundParticipation () {
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState(null)

  const [, executeJoin] = useMutation(joinFundingRoundMutation)
  const [, executeLeave] = useMutation(leaveFundingRoundMutation)

  const joinFundingRound = async (fundingRoundId) => {
    setJoining(true)
    setError(null)

    try {
      const result = await executeJoin({ id: fundingRoundId })

      if (result.error) {
        console.error('Error joining funding round:', result.error)
        setError(result.error)
        setJoining(false)
        return false
      }

      setJoining(false)
      return true
    } catch (err) {
      console.error('Error joining funding round:', err)
      setError(err)
      setJoining(false)
      return false
    }
  }

  const leaveFundingRound = async (fundingRoundId) => {
    setLeaving(true)
    setError(null)

    try {
      const result = await executeLeave({ id: fundingRoundId })

      if (result.error) {
        console.error('Error leaving funding round:', result.error)
        setError(result.error)
        setLeaving(false)
        return false
      }

      setLeaving(false)
      return true
    } catch (err) {
      console.error('Error leaving funding round:', err)
      setError(err)
      setLeaving(false)
      return false
    }
  }

  return {
    joinFundingRound,
    leaveFundingRound,
    joining,
    leaving,
    error
  }
}
