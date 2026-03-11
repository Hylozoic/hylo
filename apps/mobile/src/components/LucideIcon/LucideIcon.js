// DEPRECATED: This component is no longer used.
// All lucide icons were only used by deprecated native screens.
// The web app in WebView provides all icon rendering now.
// Kept for reference only.
// Last used: 2025-01-28

/*
import {
  BadgeDollarSign,
  Bookmark,
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
  BadgeDollarSign,
  Bookmark,
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
*/

// No-op exports - component is deprecated
export const CustomIcons = {}

export default function LucideIcon () {
  return null
}
