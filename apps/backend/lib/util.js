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
      en: 'en-US',
      'en-US': 'en-US',
      es: 'es-ES',
      'es-ES': 'es-ES',
      de: 'de-DE',
      'de-DE': 'de-DE',
      fr: 'fr-FR',
      'fr-FR': 'fr-FR',
      hi: 'hi-IN',
      'hi-IN': 'hi-IN',
      pt: 'pt-BR',
      'pt-BR': 'pt-BR',
      'pt-PT': 'pt-PT'
    }

    return lookup[locale] || 'en-US'
  }

};
