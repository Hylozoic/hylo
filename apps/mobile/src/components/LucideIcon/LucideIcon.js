import {
  CircleHelp,
  Globe,
  Grid3x3,
  LogOut,
  MapPin,
  Plus,
  Shapes,
  UserPlus
} from 'lucide-react-native'
import { black } from '@hylo/presenters/colors'

// For app size reasons only add to this set as new Icons are required
export const CustomIcons = {
  CircleHelp,
  Globe,
  Grid3x3,
  LogOut,
  MapPin,
  Plus,
  UserPlus,
  Shapes
}

export default function LucideIcon ({ name, color, size, ...forwardedProps }) {
  const CustomIcon = CustomIcons[name]

  if (!CustomIcon) {
    console.warn(`LucideIcon: "${name}" not found in CustomIcons`)
    return null
  }

  return <CustomIcon color={color || black} size={size} {...forwardedProps} />
}
