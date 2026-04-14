export function localeToFlagEmoji (locale = 'en') {
  const code = locale.length > 2 ? locale.split('-')[0] : locale

  switch (code) {
    case 'en':
      return '🇬🇧'
    case 'es':
      return '🇪🇸'
    case 'de':
      return '🇩🇪'
    case 'fr':
      return '🇫🇷'
    case 'hi':
      return '🇮🇳'
    case 'pt':
      return '🇵🇹'
    default:
      return '🇬🇧'
  }
}

export function localeToWord (locale = 'en') {
  const code = locale.length > 2 ? locale.split('-')[0] : locale

  switch (code) {
    case 'en':
      return 'English'
    case 'es':
      return 'Spanish'
    case 'de':
      return 'German'
    case 'fr':
      return 'French'
    case 'hi':
      return 'Hindi'
    case 'pt':
      return 'Portuguese'
    default:
      return 'English'
  }
}

export function getLocaleFromLocalStorage (locale) {
  if (locale) window.localStorage.setItem('hylo-i18n-lng', locale)
  return window.localStorage.getItem('hylo-i18n-lng') || 'en'
}
