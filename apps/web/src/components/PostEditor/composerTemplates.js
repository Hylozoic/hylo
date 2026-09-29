import {
  COMPOSER_ENTRY_PARAM,
  COMPOSER_TEMPLATE_INTRO,
  COMPOSER_TEMPLATE_PARAM,
  COMPOSER_TEMPLATE_WELCOME
} from '@hylo/navigation'
import { queryHyloAPI } from 'util/graphql'

// Text inside a paragraph only needs these three; quotes stay as typed so
// the editor reads the template back unchanged
const escapeHtml = text => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

/** Plain text (as stewards type it in group settings) as editor paragraphs, one per line. */
export function textToEditorHtml (text) {
  if (!text) return ''
  return String(text).split(/\r?\n/).map(line => `<p>${escapeHtml(line)}</p>`).join('')
}

export function isComposerTemplate (template) {
  return template === COMPOSER_TEMPLATE_INTRO || template === COMPOSER_TEMPLATE_WELCOME
}

/**
 * The text a composer template starts with. The introduction uses the group's
 * own Introduction template when a steward has written one, otherwise the
 * translated default. It never uses anything a member wrote when joining.
 */
export function composerTemplateText ({ template, groupIntroTemplate, t, name, groupName }) {
  if (template === COMPOSER_TEMPLATE_INTRO) {
    if (groupIntroTemplate && groupIntroTemplate.trim()) return groupIntroTemplate
    return t('introTemplateDefault', { name: name || '', groupName: groupName || '' })
  }
  if (template === COMPOSER_TEMPLATE_WELCOME) {
    return t('welcomeTemplateDefault', { groupName: groupName || '' })
  }
  return ''
}

/**
 * Reads the group's Introduction template straight from the API. Group
 * records in the store come from several queries that each pick their own
 * settings, so the store may not have it.
 */
export async function fetchGroupIntroTemplate (groupId) {
  const result = await queryHyloAPI({
    query: `query GroupIntroTemplate ($id: ID) {
      group(id: $id) {
        id
        settings {
          introTemplate
        }
      }
    }`,
    variables: { id: groupId }
  })
  return result?.data?.group?.settings?.introTemplate || null
}

/** A composer URL without the one-time template and entry parameters, for drafts to reopen at. */
export function withoutComposerTemplateParams (pathAndSearch) {
  if (!/[?&](template|composerEntry)=/.test(pathAndSearch || '')) return pathAndSearch
  try {
    const url = new URL(pathAndSearch, 'http://localhost')
    url.searchParams.delete(COMPOSER_TEMPLATE_PARAM)
    url.searchParams.delete(COMPOSER_ENTRY_PARAM)
    return `${url.pathname}${url.search}`
  } catch {
    return pathAndSearch
  }
}
