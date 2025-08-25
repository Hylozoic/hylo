import React from 'react'

// This component shows all the colors currently used in the mobile app
// alongside suggested semantic theme color replacements for migration

const ColorMigrationGuide = () => {
  // All colors currently imported from @hylo/presenters/colors in mobile app
  const mobileColors = [
    // Base colors
    { name: 'white', hex: '#FFFFFF', suggested: 'background' },
    { name: 'black', hex: '#000000', suggested: 'foreground' },
    { name: 'gainsboro', hex: '#DCDCDC', suggested: 'muted' },
    { name: 'gunsmoke', hex: '#818A88', suggested: 'mutedForeground' },
    
    // Brand colors
    { name: 'caribbeanGreen', hex: '#0DC39F', suggested: 'accent' },
    { name: 'amaranth', hex: '#EE4266', suggested: 'destructive' },
    { name: 'azureRadiance', hex: '#007AFF', suggested: 'focus' },
    { name: 'pictonBlue', hex: '#40A1DD', suggested: 'focus' },
    { name: 'havelockBlue', hex: '#41A1DC', suggested: 'focus' },
    
    // Gray scale colors
    { name: 'rhino', hex: '#2C4059', suggested: 'foreground' },
    { name: 'rhino05', hex: '#F8F9FA', suggested: 'background' },
    { name: 'rhino10', hex: '#F1F3F5', suggested: 'background' },
    { name: 'rhino20', hex: '#E3E7ED', suggested: 'muted' },
    { name: 'rhino30', hex: '#D5DBE5', suggested: 'muted' },
    { name: 'rhino40', hex: '#C7CFDD', suggested: 'muted' },
    { name: 'rhino50', hex: '#B9C3D5', suggested: 'muted' },
    { name: 'rhino60', hex: '#ABB7CD', suggested: 'muted' },
    { name: 'rhino80', hex: '#8F9FBD', suggested: 'mutedForeground' },
    
    // Other grays
    { name: 'athensGray', hex: '#FAFBFC', suggested: 'background' },
    { name: 'athensGrayDark', hex: '#E1E5EA', suggested: 'muted' },
    { name: 'athensGrayMedium', hex: '#F1F2F4', suggested: 'muted' },
    { name: 'alabaster', hex: '#F8F8F8', suggested: 'background' },
    { name: 'ghost', hex: '#CCD1D7', suggested: 'muted' },
    { name: 'doveGray', hex: '#717171', suggested: 'mutedForeground' },
    { name: 'suvaGrey', hex: '#929292', suggested: 'mutedForeground' },
    { name: 'regent', hex: '#808C9B', suggested: 'mutedForeground' },
    { name: 'slateGrey', hex: '#67768A', suggested: 'mutedForeground' },
    { name: 'slateGrey80', hex: '#8490a1', suggested: 'mutedForeground' },
    
    // Dark colors
    { name: 'bigStone', hex: '#142132', suggested: 'foreground' },
    { name: 'capeCod', hex: '#363D3C', suggested: 'foreground' },
    { name: 'limedSpruce', hex: '#38474A', suggested: 'foreground' },
    { name: 'mirage', hex: '#1F2C3D', suggested: 'foreground' },
    { name: 'nevada', hex: '#5D757A', suggested: 'mutedForeground' },
    
    // Accent colors
    { name: 'persimmon', hex: '#FE6848', suggested: 'destructive' },
    { name: 'treePoppy', hex: '#FF9D21', suggested: 'accent' },
    { name: 'gold', hex: '#FFD403', suggested: 'accent' },
    { name: 'mangoYellow', hex: '#FDD549', suggested: 'accent' },
    { name: 'mediumPurple', hex: '#9883E5', suggested: 'accent' },
    { name: 'butterflyBush', hex: '#664BA5', suggested: 'accent' },
    
    // Special colors
    { name: 'twBackground', hex: 'rgb(244, 242, 236)', suggested: 'background' },
    { name: 'black10OnCaribbeanGreen', hex: '#1A332E', suggested: 'foreground' },
    { name: 'black10onRhino', hex: '#1A1F2D', suggested: 'foreground' },
    { name: 'white80onCaribbeanGreen', hex: '#CCE8E0', suggested: 'background' },
    { name: 'white60onCaribbeanGreen', hex: '#99D1C1', suggested: 'muted' },
    { name: 'white40onCaribbeanGreen', hex: '#66BAA2', suggested: 'muted' },
    { name: 'white20onCaribbeanGreen', hex: '#33A383', suggested: 'muted' },
    { name: 'white80', hex: '#CCCCCC', suggested: 'muted' },
    
    // Opacity variants
    { name: 'capeCod05', hex: '#F7F7F7', suggested: 'background' },
    { name: 'capeCod10', hex: '#EFEFEF', suggested: 'muted' },
    { name: 'capeCod20', hex: '#DFDFDF', suggested: 'muted' },
    { name: 'capeCod40', hex: '#BFBFBF', suggested: 'muted' },
    { name: 'doveGray50', hex: '#BFBFBF', suggested: 'muted' },
    { name: 'doveGray75', hex: '#9F9F9F', suggested: 'mutedForeground' },
    { name: 'bigStone30', hex: '#1A1F2D', suggested: 'foreground' },
    
    // Gradient arrays (these are special cases)
    { name: 'bannerlinearGradientColors', hex: 'Array[4]', suggested: 'Custom gradients' },
    { name: 'postCardLinearGradientColors', hex: 'Array[2]', suggested: 'Custom gradients' }
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Mobile App Color Migration Guide</h1>
      <p className="text-lg mb-8 text-muted-foreground">
        This guide shows all colors currently used in the mobile app from @hylo/presenters/colors 
        alongside suggested semantic theme color replacements for migration.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Mobile Colors */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Current Mobile Colors</h2>
          <div className="space-y-3">
            {mobileColors.map((color) => (
              <div key={color.name} className="flex items-center space-x-3 p-3 bg-card rounded-lg border">
                <div 
                  className="w-12 h-8 rounded border-2 border-border"
                  style={{ backgroundColor: color.hex }}
                  title={color.hex}
                />
                <div className="flex-1">
                  <div className="font-mono text-sm font-medium">{color.name}</div>
                  <div className="text-xs text-muted-foreground">{color.hex}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Suggested Theme Replacements */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Suggested Theme Replacements</h2>
          <div className="space-y-3">
            {mobileColors.map((color) => (
              <div key={color.name} className="flex items-center space-x-3 p-3 bg-card rounded-lg border">
                <div 
                  className="w-12 h-8 rounded border-2 border-border"
                  style={{ 
                    backgroundColor: color.suggested === 'Custom gradients' 
                      ? '#f0f0f0' 
                      : `var(--${color.suggested})` 
                  }}
                  title={color.suggested}
                />
                <div className="flex-1">
                  <div className="font-mono text-sm font-medium">{color.suggested}</div>
                  <div className="text-xs text-muted-foreground">
                    {color.suggested === 'Custom gradients' 
                      ? 'Keep as-is (special case)' 
                      : `CSS variable: --${color.suggested}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Migration Notes */}
      <div className="mt-8 p-6 bg-muted rounded-lg">
        <h3 className="text-xl font-semibold mb-3">Migration Notes</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <strong>Background colors:</strong> Replace with <code>global.COLORS.background</code> or <code>global.COLORS.muted</code></li>
          <li>• <strong>Text colors:</strong> Replace with <code>global.COLORS.foreground</code> or <code>global.COLORS.mutedForeground</code></li>
          <li>• <strong>Accent colors:</strong> Replace with <code>global.COLORS.accent</code> or <code>global.COLORS.primary</code></li>
          <li>• <strong>Error/destructive:</strong> Replace with <code>global.COLORS.destructive</code> or <code>global.COLORS.error</code></li>
          <li>• <strong>Borders:</strong> Replace with <code>global.COLORS.border</code></li>
          <li>• <strong>Gradients:</strong> Keep as-is or create new theme-aware gradient functions</li>
        </ul>
      </div>

      {/* Priority Migration */}
      <div className="mt-6 p-6 bg-destructive/10 rounded-lg border border-destructive/20">
        <h3 className="text-xl font-semibold mb-3 text-destructive">High Priority Migration</h3>
        <p className="text-sm text-muted-foreground mb-3">
          These colors are used extensively and should be migrated first:
        </p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>• <code>twBackground</code> → <code>global.COLORS.background</code></li>
          <li>• <code>rhino*</code> variants → <code>global.COLORS.muted</code> or <code>global.COLORS.mutedForeground</code></li>
          <li>• <code>caribbeanGreen</code> → <code>global.COLORS.accent</code></li>
          <li>• <code>amaranth</code> → <code>global.COLORS.destructive</code></li>
          <li>• <code>white</code> → <code>global.COLORS.background</code></li>
          <li>• <code>black</code> → <code>global.COLORS.foreground</code></li>
        </ul>
      </div>
    </div>
  )
}

export default ColorMigrationGuide 