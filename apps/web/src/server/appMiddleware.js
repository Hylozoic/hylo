import root from 'root-path'
import { readFileSync } from 'fs'
import lodash from 'lodash'
import { withPublicPostMetaTags } from './postMetaTags.js'
import { withDefaultMetaTags, withGroupMetaTags } from './groupMetaTags.js'

export default async function appMiddleware (req, res, next) {
  const withPostTags = await withPublicPostMetaTags(html(''), req)
  const withGroupTags = await withGroupMetaTags(withPostTags, req)
  return res.status(200).send(withDefaultMetaTags(withGroupTags, req))
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
