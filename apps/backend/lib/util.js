import crypto from 'crypto'
import socketIoEmitter from 'socket.io-emitter'
import RedisClient from '../api/services/RedisClient'

module.exports = {

  getPublicKeyFromPem: function (pem) {
    const pubKeyObject = crypto.createPublicKey({
      key: Buffer.from(pem, 'base64').toString('ascii'),
      format: 'pem'
    })
    return pubKeyObject.export({
      format: 'pem',
      type: 'spki'
    })
  },

  socketIo: function () {
    return socketIoEmitter(RedisClient.create())
  },

  mapLocaleToSendWithUS: function (locale) {
    const lookup = {
      'en': 'en-US',
      'en-US': 'en-US',
      'es': 'es-ES',
      'es-ES': 'es-ES',
    }

    return lookup[locale] || 'en-US'
  }

};
