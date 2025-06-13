export function localeToFlagEmoji (locale = 'en') {
  const code = locale.length > 2 ? locale.split('-')[0] : locale

  switch (code) {
    case 'en':
      return '🇬🇧'
    case 'es':
      return '🇪🇸'
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
    default:
      return 'English'
  }
}

export function localeLocalStorageSync (locale) {
  if (locale) window.localStorage.setItem('hylo-i18n-lng', locale)
  return window.localStorage.getItem('hylo-i18n-lng') || 'en'
}
