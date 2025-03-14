import { useState, useCallback } from 'react'
import { useMutation } from 'urql'
import findOrCreateLocationMutation from '@hylo/graphql/mutations/findOrCreateLocationMutation'

export const useFindOrCreateLocationObject = () => {
  const [, findOrCreateLocation] = useMutation(findOrCreateLocationMutation)
  const [locationObject, setLocationObject] = useState(null)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState(null)

  const pollingFindOrCreateLocation = useCallback(
    async (locationData) => {
      setPolling(true)
      setError(null)

      const poll = async (delay = 0.5) => {
        if (delay > 4) {
          setPolling(false)
          setError(new Error('Polling timeout exceeded'))
          return { locationObject: null, fetching: false, error: new Error('Polling timeout exceeded') }
        }

        try {
          const { data, error } = await findOrCreateLocation(locationData)

          if (error) {
            setPolling(false)
            setError(error)
            return { locationObject: null, fetching: false, error }
          }

          const locationReceived = data?.findOrCreateLocation

          if (!locationReceived) {
            setTimeout(() => poll(delay * 2), delay * 1000)
          } else {
            setLocationObject(locationReceived)
            setPolling(false)
            return { locationObject: locationReceived, fetching: false, error: null }
          }
        } catch (e) {
          setPolling(false)
          setError(e)
          return { locationObject: null, fetching: false, error: e }
        }
      }

      return poll()
    },
    [findOrCreateLocation]
  )

  return [{ locationObject, fetching: polling, error }, pollingFindOrCreateLocation]
}

export default useFindOrCreateLocationObject
