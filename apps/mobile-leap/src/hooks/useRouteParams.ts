import { useRoute } from '@react-navigation/native'

// Reads query params React Navigation passes from deep-link path parsing.
export default function useRouteParams<T extends Record<string, unknown> = Record<string, unknown>> (): T {
  const route = useRoute()
  return (route.params ?? {}) as T
}
