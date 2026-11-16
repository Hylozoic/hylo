import fs from 'fs'
import path from 'path'
import React from 'react'
import i18next from 'i18next'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PostTypePills from './PostTypePills'
import {
  ACCEPTED_POST_TYPE_PILLS,
  CUSTOM_STREAM_POST_TYPE_PILLS,
  DEFAULT_SELECTED_POST_TYPES
} from 'components/CustomViewForm/customViewFormConstants'

let mockT = key => key
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (...args) => mockT(...args) })
}))

const localesDir = path.resolve(__dirname, '../../../public/locales')
const localeFiles = fs.readdirSync(localesDir).filter(file => file.endsWith('.json'))

function loadLocale (file) {
  return JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'))
}

async function useRealI18n (lng, resources) {
  const instance = i18next.createInstance()
  await instance.init({
    lng,
    resources: { [lng]: { translation: resources } },
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false }
  })
  mockT = instance.t.bind(instance)
}

describe('PostTypePills', () => {
  it.each(localeFiles)('%s has a translation for every post type pill', file => {
    const translations = loadLocale(file)
    const labelKeys = [...CUSTOM_STREAM_POST_TYPE_PILLS, ...ACCEPTED_POST_TYPE_PILLS].map(option => option.labelKey)
    labelKeys.forEach(key => {
      expect({ key, value: translations[key] }).toEqual({ key, value: expect.any(String) })
      expect(translations[key]).not.toEqual(key)
    })
  })

  it('renders translated labels for the separate request and offer pills', async () => {
    await useRealI18n('es', loadLocale('es.json'))
    render(<PostTypePills postTypes={DEFAULT_SELECTED_POST_TYPES} onPostTypesChange={() => {}} options={CUSTOM_STREAM_POST_TYPE_PILLS} />)

    expect(screen.getByTestId('post-type-pill-request')).toHaveTextContent('Solicitudes')
    expect(screen.getByTestId('post-type-pill-offer')).toHaveTextContent('Ofertas')
    CUSTOM_STREAM_POST_TYPE_PILLS.forEach(option => {
      expect(screen.getByTestId(`post-type-pill-${option.key}`)).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByTestId(`post-type-pill-${option.key}`).textContent).not.toMatch(/view-/)
    })
  })

  it('falls back to a readable label rather than the raw key when a locale lacks it', async () => {
    await useRealI18n('en', {})
    render(<PostTypePills postTypes={[]} onPostTypesChange={() => {}} options={CUSTOM_STREAM_POST_TYPE_PILLS} />)

    expect(screen.getByTestId('post-type-pill-request')).toHaveTextContent('Requests')
    expect(screen.getByTestId('post-type-pill-offer')).toHaveTextContent('Offers')
    expect(screen.queryByText(/^view-/)).not.toBeInTheDocument()
  })
})
