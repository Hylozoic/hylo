let callback
module.exports = {
  finishImagePicker: result => callback(result),
  showImagePicker: jest.fn((options, cb) => {
    callback = cb
  })
}
