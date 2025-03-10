import { CircleHelp, Globe, Plus } from 'lucide-react-native'
import { black } from 'style/colors'

// For app size reasons only add to this set as new Icons are required,
// loading entire Lucide icons set causes a lot of app size bloat
export const CustomIcons = { CircleHelp, Globe, Plus }

export default function LucideIcon ({ name, color, size}) {
  if (!name) return null

  const CustomIcon = CustomIcons[name]

  return (
    <CustomIcon color={color || black} size={size || 30} />
  )
}
