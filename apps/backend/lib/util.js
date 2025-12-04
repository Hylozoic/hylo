import crypto from 'crypto'
import socketIoEmitter from 'socket.io-emitter'
import RedisClient from '../api/services/RedisClient'

// Singleton socket.io emitter to prevent creating multiple Redis clients
let socketIoEmitterInstance = null

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
    if (!socketIoEmitterInstance) {
      socketIoEmitterInstance = socketIoEmitter(RedisClient.create())
    }
    return socketIoEmitterInstance
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
