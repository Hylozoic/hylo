# Theme-Aware Color System

This directory contains an auto-generated theme-aware color system that provides JavaScript access to your NativeWind CSS custom properties.

## Overview

The color system automatically parses your `global.css` file and generates JavaScript constants that can be used throughout your React Native app. It supports both light and dark themes with automatic switching.

## Files

- `global.css` - Your NativeWind CSS file with CSS custom properties
- `theme-colors.js` - **Auto-generated** color constants (do not edit manually)
- `README.md` - This documentation file

## How It Works

1. **Build Time**: The `configure.sh` script automatically runs `generate-theme-colors.js`
2. **CSS Parsing**: Extracts CSS custom properties from both `:root` (light) and `.dark` (dark) blocks
3. **JavaScript Generation**: Creates a comprehensive color system with theme switching capabilities
4. **Global Access**: Colors are available globally as `global.COLORS` without imports

## Usage

### Global Access (No Import Required)

```javascript
// Access colors from anywhere in your app
const backgroundColor = global.COLORS.background
const textColor = global.COLORS.foreground
const accentColor = global.COLORS.accent

// Check current theme
const currentTheme = global.CURRENT_THEME

// Switch themes
global.setTheme('dark')
global.setTheme('light')
```

### Imported Access

```javascript
import { Colors, useThemeColors, setTheme } from '../style/theme-colors'

// Dynamic access (always current theme)
const bgColor = Colors.background
const primaryColor = Colors.primary

// Hook for React components
function MyComponent() {
  const colors = useThemeColors()
  
  return (
    <View style={{ backgroundColor: colors.background }}>
      <Text style={{ color: colors.foreground }}>
        This automatically adapts to theme changes
      </Text>
    </View>
  )
}

// Manual theme switching
setTheme('dark')
```

### Available Colors

The system automatically generates constants for all CSS custom properties in your `global.css`:

#### Semantic Colors
- `background` - Main background color
- `foreground` - Main text color
- `primary` - Primary brand color
- `secondary` - Secondary brand color
- `accent` - Accent/highlight color
- `muted` - Muted/subtle color
- `destructive` - Error/danger color
- `error` - Error color
- `border` - Border color
- `input` - Input field color
- `ring` - Focus ring color
- `card` - Card background color
- `popover` - Popover background color
- `selected` - Selected state color
- `midground` - Mid-level background color
- `focus` - Focus state color

#### Chart Colors
- `chart-1` through `chart-5` - Chart color palette

#### Theme-Specific Colors
- `theme-background` - Theme-specific background
- `theme-foreground` - Theme-specific foreground

## Theme Switching

### Automatic (System Theme)
The system automatically follows the device's color scheme preference using `useColorScheme()`.

### Manual
```javascript
// Switch to dark theme
global.setTheme('dark')

// Switch to light theme
global.setTheme('light')

// Check current theme
console.log(global.CURRENT_THEME)
```

## Integration with NativeWind

This system works alongside NativeWind - you can use both approaches:

```javascript
// NativeWind classes (for styled components)
<View className="bg-background text-foreground" />

// JavaScript constants (for native components, third-party libraries)
<View style={{ backgroundColor: global.COLORS.background }} />
```

## Regeneration

The color system is automatically regenerated when you run:

```bash
./apps/mobile/scripts/configure.sh
```

This happens automatically in your CI/CD pipeline (Bitrise) and during local development setup.

## Benefits

1. **No Imports Required** - Colors available globally
2. **Theme Switching** - Automatic and manual theme switching
3. **Type Safety** - Consistent color names across themes
4. **Performance** - No runtime parsing overhead
5. **CI/CD Integration** - Automatically generated during build
6. **Native Component Support** - Works with third-party libraries that can't use NativeWind

## Example Component

See `ColorDemo.js` for a complete example of how to use the color system, including theme switching and color display.

## Troubleshooting

### Colors Not Updating
- Ensure you've run `configure.sh` after updating `global.css`
- Check that CSS custom properties are properly defined in both `:root` and `.dark` blocks

### Import Errors
- The `theme-colors.js` file is auto-generated - don't edit it manually
- If you get import errors, run `configure.sh` to regenerate the file

### Theme Not Switching
- Verify that `global.setTheme()` is being called
- Check that the theme name matches exactly ('light' or 'dark')
- Ensure the component is re-rendering after theme changes 