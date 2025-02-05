import { useState, useCallback } from 'react'
import { gql, useMutation } from 'urql'

export const findOrCreateLocationMutation = gql`
  mutation FindOrCreateLocationMutation (
    $accuracy: String,
    $addressNumber: String,
    $addressStreet: String,
    $bbox: [PointInput],
    $center: PointInput,
    $city: String,
    $country: String,
    $fullText: String,
    $geometry: [PointInput],
    $locality: String,
    $neighborhood: String,
    $region: String,
    $postcode: String,
    $wikidata: String
  ) {
    findOrCreateLocation(data: {
      accuracy: $accuracy,
      addressNumber: $addressNumber,
      addressStreet: $addressStreet,
      bbox: $bbox,
      center: $center
      city: $city
      country: $country,
      fullText: $fullText,
      geometry: $geometry,
      locality: $locality,
      neighborhood: $neighborhood,
      region: $region,
      postcode: $postcode,
      wikidata: $wikidata
    }) {
      id
      accuracy
      addressNumber
      addressStreet
      bbox {
        lat
        lng
      }
      center {
        lat
        lng
      }
      city
      country
      fullText
      locality
      neighborhood
      region
      postcode
    }
  }
`

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
