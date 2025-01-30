import { useQuery } from 'urql'
import platformAgreementsQuery from 'graphql/queries/platformAgreementsQuery'

export default function usePlatformAgreements () {
  const [{ data: platformAgreementsData, fetching }] = useQuery({ query: platformAgreementsQuery })

  return [platformAgreementsData?.platformAgreements, fetching]
}
