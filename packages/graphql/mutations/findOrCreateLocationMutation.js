import { gql } from 'urql'

export default gql`
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
