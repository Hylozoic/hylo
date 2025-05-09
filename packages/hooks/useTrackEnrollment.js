import { useMutation } from 'urql'
import enrollInTrackMutation from '@hylo/graphql/mutations/enrollInTrackMutation'
import leaveTrackMutation from '@hylo/graphql/mutations/leaveTrackMutation'

export default function useTrackEnrollment () {
  const [enrollResult, enrollInTrack] = useMutation(enrollInTrackMutation)
  const [leaveResult, leaveTrack] = useMutation(leaveTrackMutation)

  const handleEnrollInTrack = async (trackId) => {
    const result = await enrollInTrack({ trackId })
    return result?.data?.enrollInTrack?.id != null
  }

  const handleLeaveTrack = async (trackId) => {
    const result = await leaveTrack({ trackId })
    return result?.data?.leaveTrack?.id != null
  }

  return {
    enrollInTrack: handleEnrollInTrack,
    leaveTrack: handleLeaveTrack,
    enrolling: enrollResult.fetching,
    leaving: leaveResult.fetching,
    error: enrollResult.error || leaveResult.error
  }
} 