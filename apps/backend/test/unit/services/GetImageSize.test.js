var root = require('root-path')
require(root('test/setup'))
var GetImageSize = require(root('api/services/GetImageSize'))
var { stubGetImageSize } = require(root('test/setup/helpers'))

describe('GetImageSize', () => {
  it('gets the size', function () {
    this.timeout(5000)
    stubGetImageSize('http://cdn.hylo.com/misc/hylo-logo-teal-on-transparent.png')
    return GetImageSize('http://cdn.hylo.com/misc/hylo-logo-teal-on-transparent.png')
    .then(dimensions => {
      expect(dimensions.width).to.equal(1)
      expect(dimensions.height).to.equal(1)
    })
  })
})
