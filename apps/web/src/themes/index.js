// Theme definitions for Hylo
export const baseTheme = {
  light: {
    black: '50 9% 15%',
    background: '60 12% 88%',
    midground: '60 16% 94%',
    foreground: '240 10% 3.9%',
    selected: '145 50% 62%',
    card: '40 100% 99%',
    cardForeground: '34 9% 15%',
    popover: '0 0% 100%',
    popoverForeground: '240 10% 3.9%',
    primary: '240 3% 82%',
    primaryForeground: '0 0% 0%',
    secondary: '196 100% 50%',
    secondaryForeground: '0 0% 100%',
    muted: '240 4.8% 95.9%',
    mutedForeground: '240 3.8% 46.1%',
    accent: '21 79% 63%',
    accentForeground: '0 0 100%',
    destructive: '0 84.2% 60.2%',
    destructiveForeground: '0 0% 98%',
    error: '0 84.2% 60.2%',
    errorForeground: '0 0% 98%',
    focus: '203 70% 56%',
    border: '240 5.9% 90%',
    input: '42 5.9% 100%',
    ring: '240 10% 3.9%'
  },
  dark: {
    black: '180 2% 2%',
    background: '180 6% 15%',
    midground: '180 4% 20%',
    foreground: '40 100% 99%',
    card: '190 9% 23%',
    cardForeground: '40 100% 99%',
    popover: '240 10% 3.9%',
    popoverForeground: '0 0% 98%',
    primary: '190 7% 5%',
    primaryForeground: '40 100% 99%',
    secondary: '169 44% 48%',
    secondaryForeground: '0 0% 98%',
    selected: '145 40% 45%',
    muted: '240 3.7% 15.9%',
    mutedForeground: '240 5% 64.9%',
    accent: '21 79% 63%',
    accentForeground: '0 0% 98%',
    destructive: '0 62.8% 30.6%',
    destructiveForeground: '0 0% 98%',
    error: '0 84.2% 60.2%',
    errorForeground: '0 0% 98%',
    border: '240 3.7% 15.9%',
    input: '200 2.7% 8.9%',
    ring: '240 4.9% 83.9%'
  }
}

export const forestTheme = {
  light: {
    ...baseTheme.light,
    background: '95 15% 92%',
    midground: '95 12% 96%',
    foreground: '95 10% 10%',
    primary: '95 90% 95%',
    secondary: '120 15% 45%',
    accent: '65 25% 45%',
    selected: '95 30% 45%',
    card: '95 10% 98%',
    cardForeground: '95 10% 10%',
    muted: '95 10% 90%',
    mutedForeground: '95 10% 40%'
  },
  dark: {
    ...baseTheme.dark,
    background: '95 20% 12%',
    midground: '95 15% 15%',
    foreground: '95 10% 90%',
    primary: '95 10% 10%',
    secondary: '120 20% 25%',
    accent: '65 30% 25%',
    selected: '95 35% 25%',
    card: '95 15% 20%',
    cardForeground: '95 10% 90%',
    muted: '95 15% 18%',
    mutedForeground: '95 10% 60%'
  }
}

export const oceanTheme = {
  light: {
    ...baseTheme.light,
    background: '200 20% 92%',
    midground: '200 25% 96%',
    foreground: '200 30% 10%',
    primary: '200 90% 95%',
    secondary: '220 40% 45%',
    accent: '180 45% 45%',
    selected: '200 50% 45%',
    card: '200 15% 98%',
    cardForeground: '200 30% 10%',
    muted: '200 15% 90%',
    mutedForeground: '200 20% 40%'
  },
  dark: {
    ...baseTheme.dark,
    background: '200 25% 12%',
    midground: '200 30% 15%',
    foreground: '200 10% 90%',
    primary: '200 10% 10%',
    secondary: '220 40% 25%',
    accent: '180 45% 25%',
    selected: '200 50% 25%',
    card: '200 20% 20%',
    cardForeground: '200 10% 90%',
    muted: '200 25% 18%',
    mutedForeground: '200 15% 60%'
  }
}

export const desertTheme = {
  light: {
    ...baseTheme.light,
    background: '35 50% 92%',
    midground: '35 50% 96%',
    foreground: '35 35% 10%',
    primary: '35 90% 95%',
    secondary: '25 45% 45%',
    accent: '15 50% 45%',
    selected: '35 55% 45%',
    card: '35 20% 98%',
    cardForeground: '35 35% 10%',
    muted: '35 20% 90%',
    mutedForeground: '35 25% 40%'
  },
  dark: {
    ...baseTheme.dark,
    background: '25 25% 12%',
    midground: '25 25% 15%',
    foreground: '25 10% 90%',
    primary: '35 10% 10%',
    secondary: '25 45% 25%',
    accent: '15 50% 25%',
    selected: '25 55% 25%',
    card: '25 25% 20%',
    cardForeground: '25 10% 90%',
    muted: '25 30% 18%',
    mutedForeground: '25 20% 60%'
  }
}

export const snowTheme = {
  light: {
    ...baseTheme.light,
    background: '210 10% 95%',
    midground: '210 15% 98%',
    foreground: '210 20% 10%',
    primary: '210 90% 90%',
    secondary: '200 30% 85%',
    accent: '190 35% 85%',
    selected: '210 40% 85%',
    card: '210 5% 100%',
    cardForeground: '210 20% 10%',
    muted: '210 10% 92%',
    mutedForeground: '210 15% 40%'
  },
  dark: {
    ...baseTheme.dark,
    background: '210 15% 15%',
    midground: '210 20% 18%',
    foreground: '210 10% 95%',
    primary: '210 10% 10%',
    secondary: '200 30% 30%',
    accent: '190 35% 30%',
    selected: '210 40% 30%',
    card: '210 10% 22%',
    cardForeground: '210 10% 95%',
    muted: '210 15% 20%',
    mutedForeground: '210 10% 70%'
  }
}

export const jungleTheme = {
  light: {
    ...baseTheme.light,
    background: '150 35% 92%',
    midground: '150 40% 96%',
    foreground: '150 45% 10%',
    primary: '150 90% 90%',
    secondary: '160 55% 45%',
    accent: '140 60% 45%',
    selected: '150 65% 45%',
    card: '150 30% 98%',
    cardForeground: '150 45% 10%',
    muted: '150 30% 90%',
    mutedForeground: '150 35% 40%'
  },
  dark: {
    ...baseTheme.dark,
    background: '150 40% 12%',
    midground: '150 45% 15%',
    foreground: '150 10% 90%',
    primary: '150 10% 10%',
    secondary: '160 55% 25%',
    accent: '140 60% 25%',
    selected: '150 65% 25%',
    card: '150 35% 20%',
    cardForeground: '150 10% 90%',
    muted: '150 40% 18%',
    mutedForeground: '150 30% 60%'
  }
}

export const themes = {
  base: baseTheme,
  forest: forestTheme,
  ocean: oceanTheme,
  desert: desertTheme,
  snow: snowTheme,
  jungle: jungleTheme
}

export const defaultTheme = 'base'
