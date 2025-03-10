import {
  CircleHelp,
  Globe,
  Plus,
} from 'lucide-react-native'
import { black } from 'style/colors'

// For app size reasons only add to this set as new Icons are required
export const CustomIcons = {
  CircleHelp,
  Globe,
  Plus
}

export default function LucideIcon ({ name, color, size, ...forwardedProps }) {
  const CustomIcon = CustomIcons[name]

  if (!CustomIcon) {
    console.warn(`LucideIcon: "${name}" not found in CustomIcons`)
    return null
  }

  return <CustomIcon color={color || black} size={size || 30} {...forwardedProps} />
}
