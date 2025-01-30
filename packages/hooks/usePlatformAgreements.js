import { useQuery } from 'urql'
import platformAgreementsQuery from '@hylo/graphql/queries/platformAgreementsQuery'

export default function usePlatformAgreements () {
  const [{ data: platformAgreementsData, fetching }] = useQuery({ query: platformAgreementsQuery })

  return [platformAgreementsData?.platformAgreements, fetching]
}
