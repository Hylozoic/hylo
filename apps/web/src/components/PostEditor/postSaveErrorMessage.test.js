import i18next from 'i18next'
import en from '../../../public/locales/en.json'
import de from '../../../public/locales/de.json'
import postSaveErrorMessage, { formatList, POST_TYPE_NOT_ACCEPTED } from './postSaveErrorMessage'

// A real i18next instance (react-i18next is mocked globally) so plural keys resolve.
async function translator (lng) {
  const i18n = i18next.createInstance()
  await i18n.init({
    lng,
    fallbackLng: 'en',
    resources: { en: { translation: en }, de: { translation: de } },
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false }
  })
  return i18n.t.bind(i18n)
}

const rejection = (destinations, postType = 'discussion') => ({
  message: 'English fallback from the server',
  extensions: { code: POST_TYPE_NOT_ACCEPTED, postType, destinations }
})

describe('postSaveErrorMessage', () => {
  it('names one blocking destination with a singular verb', async () => {
    const t = await translator('en')
    expect(postSaveErrorMessage(rejection(['Hylo Stewards / partnerships']), t, 'en-US'))
      .toBe('Hylo Stewards / partnerships does not accept Discussion posts')
  })

  it('joins two blocking destinations with a plural verb', async () => {
    const t = await translator('en')
    expect(postSaveErrorMessage(rejection(['Hylo Stewards / partnerships', 'Discussion Only'], 'event'), t, 'en-US'))
      .toBe('Hylo Stewards / partnerships and Discussion Only do not accept Event posts')
  })

  it('builds the sentence in German, with a German list conjunction and post type', async () => {
    const t = await translator('de')
    expect(postSaveErrorMessage(rejection(['Hylo Stewards / partnerships']), t, 'de-DE'))
      .toBe('Hylo Stewards / partnerships akzeptiert keine Beiträge vom Typ „Diskussion“')
    expect(postSaveErrorMessage(rejection(['A / b', 'C', 'D'], 'event'), t, 'de-DE'))
      .toBe('A / b, C und D akzeptieren keine Beiträge vom Typ „Veranstaltung“')
  })

  it("shows the server's message for other errors", async () => {
    const t = await translator('en')
    expect(postSaveErrorMessage({ message: 'unable to post to all those groups' }, t, 'en-US'))
      .toBe('unable to post to all those groups')
    // Code without destinations: fall back to the server's message
    expect(postSaveErrorMessage({ message: 'fallback', extensions: { code: POST_TYPE_NOT_ACCEPTED } }, t, 'en-US'))
      .toBe('fallback')
  })

  it('shows a generic message when there is no server message', async () => {
    const t = await translator('en')
    expect(postSaveErrorMessage({}, t, 'en-US')).toBe('There was an error, please try again.')
    expect(postSaveErrorMessage(undefined, t, 'en-US')).toBe('There was an error, please try again.')
  })
})

describe('formatList', () => {
  it('falls back to a comma join for an invalid locale', () => {
    expect(formatList(['A', 'B'], 'not a locale!')).toBe('A, B')
  })

  it('falls back to a comma join without Intl.ListFormat', () => {
    const original = Intl.ListFormat
    try {
      delete Intl.ListFormat
      expect(formatList(['A', 'B', 'C'], 'en-US')).toBe('A, B, C')
    } finally {
      Intl.ListFormat = original
    }
  })
})
