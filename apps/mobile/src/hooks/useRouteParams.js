import { useRoute } from '@react-navigation/native'

const useRouteParams = () => {
  const route = useRoute()

  return route.params || {}
};

export default useRouteParams
