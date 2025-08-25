# Mobile Color System Documentation

## Overview

The mobile app now uses a semantic, theme-aware color system that automatically switches between light and dark themes. This system replaces the old hardcoded colors from `@hylo/presenters/colors` with semantic colors that adapt to the current theme.

## Core Files

- **`theme-colors.js`** - Auto-generated theme definitions and color access
- **`COLOR_SYSTEM.md`** - This documentation file

## How to Use Colors

### Basic Semantic Colors

```javascript
import Colors from '../style/theme-colors'

// Basic semantic colors
const backgroundColor = Colors.background      // Light: #e7e3da, Dark: #4d4842
const textColor = Colors.foreground           // Light: #09090b, Dark: #fffdfa
const accentColor = Colors.selected           // Light: #6ecf96, Dark: #45b09d
const mutedColor = Colors.muted               // Light: #f4f4f5, Dark: #27272a
```

### Transparency Variants

The system now supports transparency variants for any semantic color using the pattern `Colors.colorNameXX` where `XX` is the opacity percentage:

```javascript
// Transparency variants (NEW!)
const lightBackground = Colors.background30   // 30% opacity of background
const mutedText = Colors.foreground60        // 60% opacity of foreground
const subtleBorder = Colors.foreground10     // 10% opacity of foreground
const strongAccent = Colors.selected80        // 80% opacity of selected
```

### Available Transparency Levels

Based on actual usage in the app, these transparency levels are supported:
- **05** (5%) - Very subtle backgrounds
- **10** (10%) - Light backgrounds, subtle borders
- **20** (20%) - Light borders, muted elements
- **30** (30%) - Borders, muted text
- **40** (40%) - Medium borders, text
- **50** (50%) - Medium text
- **60** (60%) - Text
- **80** (80%) - Borders, strong text

## Migration Guide

### Old Colors → New Semantic Colors

| Old Color | New Color | Usage |
|-----------|-----------|-------|
| `twBackground` | `Colors.background` | Background colors |
| `rhino` | `Colors.foreground` | Text, borders |
| `rhino80` | `Colors.foreground80` | Borders, text (80% opacity) |
| `rhino60` | `Colors.foreground60` | Text (60% opacity) |
| `rhino50` | `Colors.foreground50` | Text (50% opacity) |
| `rhino40` | `Colors.foreground40` | Borders, text (40% opacity) |
| `rhino30` | `Colors.foreground30` | Borders, muted text (30% opacity) |
| `rhino20` | `Colors.foreground20` | Light borders (20% opacity) |
| `rhino10` | `Colors.foreground10` | Light backgrounds (10% opacity) |
| `rhino05` | `Colors.foreground05` | Very subtle backgrounds (5% opacity) |
| `caribbeanGreen` | `Colors.selected` | Accent colors, highlights |
| `caribbeanGreen` variants | `Colors.selectedXX` | Transparency variants (10%, 20%, 40%, 60%, 80%) |
| `capeCod` | `Colors.foreground` | Text, borders |
| `capeCod10` | `Colors.foreground10` | Light backgrounds (10% opacity) |
| `capeCod20` | `Colors.foreground20` | Light borders (20% opacity) |
| `capeCod40` | `Colors.foreground40` | Medium borders, text (40% opacity) |
| `athensGray` | `Colors.muted` | Muted backgrounds |
| `athensGrayDark` | `Colors.mutedForeground` | Muted borders, text |
| `doveGray50` | `Colors.foreground50` | Medium text (50% opacity) |
| `doveGray75` | `Colors.foreground75` | Text (75% opacity) |
| `amaranth` | `Colors.destructive` | Error states, destructive actions |
| `persimmon` | `Colors.accent` | Warning states, accent elements |
| `treePoppy` | `Colors.accent` | Accent elements |
| `mangoYellow` | `Colors.accent` | Accent elements |
| `gunsmoke` | `Colors.mutedForeground` | Muted text, borders |
| `gainsboro` | `Colors.primary` | Primary elements, press states |

### Example Migration

**Before:**
```javascript
import { rhino, rhino30, rhino80 } from '@hylo/presenters/colors'

const styles = StyleSheet.create({
  container: {
    backgroundColor: rhino30,
    borderColor: rhino80,
    color: rhino
  }
})
```

**After:**
```javascript
import Colors from '../style/theme-colors'

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.foreground30,
    borderColor: Colors.foreground80,
    color: Colors.foreground
  }
})
```

## Theme Switching

The system automatically detects the device's color scheme and switches themes. You can also manually switch themes:

```javascript
import { setTheme } from '../style/theme-colors'

// Switch to dark theme
setTheme('dark')

// Switch to light theme
setTheme('light')
```

## Benefits

1. **Automatic Theme Switching** - Colors adapt to light/dark mode
2. **Semantic Naming** - Colors are named by purpose, not appearance
3. **Transparency Support** - Easy opacity variants for any color
4. **Consistent API** - Single import for all colors
5. **Performance** - No runtime color calculations
6. **Maintainability** - Centralized color definitions

## Technical Details

### How Transparency Works

The system uses a `withAlpha()` utility function that converts hex colors to rgba:

```javascript
// Internal implementation
function withAlpha(hexColor, alpha) {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Usage
Colors.foreground80  // Converts #09090b to rgba(9, 9, 11, 0.8)
```

### Proxy Implementation

The `Colors` object is a JavaScript Proxy that:
1. Intercepts property access
2. Detects transparency patterns (e.g., `foreground80`)
3. Automatically converts hex to rgba with the specified opacity
4. Falls back to regular color lookup for non-transparency variants

## Best Practices

1. **Use semantic names** - `Colors.foreground` instead of `Colors.black`
2. **Leverage transparency** - `Colors.foreground30` instead of custom colors
3. **Import once** - Import `Colors` at the top of each file
4. **Use relative paths** - `../style/theme-colors` or adjust based on file depth
5. **Test both themes** - Verify colors work in both light and dark modes

## Troubleshooting

### Common Issues

1. **Import path errors** - Check relative path depth (`../`, `../../`, etc.)
2. **Undefined colors** - Verify color name exists in `SEMANTIC_COLORS`
3. **Theme not switching** - Ensure `useColorScheme()` hook is used in root component

### Debug Mode

```javascript
import { getCurrentThemeColors, getColor } from '../style/theme-colors'

// Check current theme colors
console.log('Current theme:', getCurrentThemeColors())

// Check specific color
console.log('Background color:', getColor('background'))
```

## Future Enhancements

- [ ] CSS custom properties for web compatibility
- [ ] Color palette generation tools
- [ ] Accessibility contrast validation
- [ ] Custom theme support
- [ ] Color animation support
