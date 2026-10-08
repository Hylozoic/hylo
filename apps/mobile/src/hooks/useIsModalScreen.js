import { useRoute } from '@react-navigation/native'

export const MODAL_SCREEN_SUFFIX = ' - Modal'

export function modalScreenName (screenNameOrPath) {
  return screenNameOrPath + MODAL_SCREEN_SUFFIX
}

export default function useIsModalScreen () {
  const route = useRoute()
  const routeName = route?.name || ''

  return routeName.match(new RegExp(`${MODAL_SCREEN_SUFFIX}$`))
}
