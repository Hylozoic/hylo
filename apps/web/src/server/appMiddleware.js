import root from 'root-path'
import { readFileSync } from 'fs'
import lodash from 'lodash'
import { withPublicMetaTags } from './publicMetaTags.js'

export default async function appMiddleware (req, res, next) {
  const page = await withPublicMetaTags(html(''), req)
  return res.status(200).send(page)
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
