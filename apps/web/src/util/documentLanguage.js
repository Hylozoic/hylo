/**
 * Keeps <html lang> in step with the active locale, so screen readers
 * pronounce text in the right language and the browser doesn't offer to
 * translate a page that is already in the reader's language.
 */
export function syncDocumentLanguage (i18n) {
  const apply = language => {
    if (language && typeof document !== 'undefined') document.documentElement.lang = language
  }
  i18n.on('languageChanged', apply)
  apply(i18n.language)
}
