import { useRoute } from '@react-navigation/native'

export const getLastParams = (state) => {
  let current = state

  while (current?.params?.params) {
    current = current.params
  }

  return current?.params || null
}

const useRouteParams = ({ reset = false } = {}) => {
  const route = useRoute()
  const params = getLastParams(route) || {}

  return params
}

export default useRouteParams
