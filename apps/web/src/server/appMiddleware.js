import root from 'root-path'
import { readFileSync } from 'fs'
import lodash from 'lodash'
import { withPublicPostMetaTags } from './postMetaTags.js'
import { withAppBannerMetaTag, withDefaultMetaTags, withGroupMetaTags } from './groupMetaTags.js'

export default async function appMiddleware (req, res, next) {
  const withPostTags = await withPublicPostMetaTags(html(''), req)
  const withGroupTags = await withGroupMetaTags(withPostTags, req)
  // The default preview description follows the request's language
  if (typeof res.vary === 'function') res.vary('Accept-Language')
  return res.status(200).send(withAppBannerMetaTag(withDefaultMetaTags(withGroupTags, req), req))
}

// A property to make it easy to mock in tests
appMiddleware.getIndexFile = lodash.once(() => {
  const indexPath = root('dist/index.html')
  return readFileSync(indexPath, { encoding: 'utf-8' })
})

function html (markup) {
  const newRoot = `<div id="root">${markup}</div>`
  return appMiddleware.getIndexFile().replace('<div id="root"></div>', newRoot)
}
