#!/usr/bin/env node
const { getEnvVar } = require('./lib')
const path = require('path')

// Try to require restler from backend node_modules (it's a dependency of sendwithus)
let restler
try {
  restler = require('restler')
} catch (err) {
  try {
    const backendPath = path.resolve(__dirname, '../../apps/backend/node_modules/restler')
    restler = require(backendPath)
  } catch (err2) {
    throw new Error('restler package not found. It should be installed as a dependency of sendwithus.')
  }
}

// Try to require sendwithus from backend node_modules, or from root
let sendwithus
try {
  sendwithus = require('sendwithus')
} catch (err) {
  // Try from backend node_modules
  try {
    const backendPath = path.resolve(__dirname, '../../apps/backend/node_modules/sendwithus')
    sendwithus = require(backendPath)
  } catch (err2) {
    throw new Error('sendwithus package not found. Install it with: yarn add sendwithus (in scripts/i18n or root)')
  }
}

/**
 * Creates a SendWithUs API client instance
 * @param {string} [apiKey] - Optional API key, otherwise reads from env
 * @returns {Object} SendWithUs API client
 */
function createClient (apiKey) {
  const key = apiKey || getEnvVar('SENDWITHUS_KEY')
  if (!key) {
    throw new Error('SENDWITHUS_KEY not found in environment or .env files')
  }
  return sendwithus(key)
}

/**
 * Promisifies a callback-based API call
 * @param {Function} fn - Function that takes a callback
 * @param {...any} args - Arguments to pass to the function
 * @returns {Promise} API response
 */
function promisifyCall (fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (err, result) => {
      if (err) {
        const error = new Error(`SendWithUs API error: ${err.message || 'Unknown error'}`)
        error.statusCode = err.statusCode
        error.response = result
        reject(error)
      } else {
        resolve(result)
      }
    })
  })
}

/**
 * Get all templates
 * @param {Object} [client] - Optional SendWithUs client, otherwise creates one
 * @returns {Promise<Array>} List of templates
 */
async function getTemplates (client) {
  const api = client || createClient()
  // The sendwithus package uses 'emails' method for templates
  return promisifyCall(api.emails.bind(api))
}

/**
 * Get a specific template
 * Note: The sendwithus package doesn't have a direct method for this.
 * We'll need to use a custom request or get it from the templates list.
 * @param {string} templateId - Template ID
 * @param {string} [locale] - Optional locale (not supported by package)
 * @param {Object} [client] - Optional SendWithUs client
 * @returns {Promise<Object>} Template object
 */
async function getTemplate (templateId, locale, client) {
  // The package doesn't have a direct getTemplate method
  // We'll fetch all templates and find the one we need
  const templates = await getTemplates(client)
  const template = templates.find(t => t.id === templateId)
  if (!template) {
    const error = new Error(`Template ${templateId} not found`)
    error.statusCode = 404
    throw error
  }
  return template
}

/**
 * Get template versions
 * Note: The sendwithus package doesn't have a direct method for this.
 * We'll need to make a custom HTTP request.
 * @param {string} templateId - Template ID
 * @param {string} [locale] - Optional locale
 * @param {Object} [client] - Optional SendWithUs client
 * @returns {Promise<Array>} List of template versions
 */
async function getTemplateVersions (templateId, locale, client) {
  const api = client || createClient()
  const url = locale
    ? `https://api.sendwithus.com/api/v1_0/templates/${templateId}/locales/${locale}/versions`
    : `https://api.sendwithus.com/api/v1_0/templates/${templateId}/versions`

  return new Promise((resolve, reject) => {
    restler.get(url, {
      headers: {
        'X-SWU-API-KEY': api.API_KEY,
        'X-SWU-API-CLIENT': 'node-2.10.0'
      }
    }).once('complete', (result, response) => {
      if (response.statusCode === 200) {
        resolve(result)
      } else {
        const error = new Error(`Request failed with ${response.statusCode}`)
        error.statusCode = response.statusCode
        error.response = result
        reject(error)
      }
    })
  })
}

/**
 * Get a specific template version
 * Note: The sendwithus package doesn't have a direct method for this.
 * We'll need to make a custom HTTP request.
 * @param {string} templateId - Template ID
 * @param {string} versionId - Version ID
 * @param {string} [locale] - Optional locale
 * @param {Object} [client] - Optional SendWithUs client
 * @returns {Promise<Object>} Template version object
 */
async function getTemplateVersion (templateId, versionId, locale, client) {
  const api = client || createClient()
  const url = locale
    ? `https://api.sendwithus.com/api/v1_0/templates/${templateId}/locales/${locale}/versions/${versionId}`
    : `https://api.sendwithus.com/api/v1_0/templates/${templateId}/versions/${versionId}`

  return new Promise((resolve, reject) => {
    restler.get(url, {
      headers: {
        'X-SWU-API-KEY': api.API_KEY,
        'X-SWU-API-CLIENT': 'node-2.10.0'
      }
    }).once('complete', (result, response) => {
      if (response.statusCode === 200) {
        resolve(result)
      } else {
        const error = new Error(`Request failed with ${response.statusCode}`)
        error.statusCode = response.statusCode
        error.response = result
        reject(error)
      }
    })
  })
}

/**
 * Create a new template
 * @param {Object} templateData - Template data (name, subject, html, text, etc.)
 * @param {Object} [client] - Optional SendWithUs client
 * @returns {Promise<Object>} Created template object
 */
async function createTemplate (templateData, client) {
  const api = client || createClient()
  return promisifyCall(api.createTemplate.bind(api), templateData)
}

/**
 * Update a template
 * Note: The sendwithus package doesn't have a direct method for this.
 * We'll need to make a custom HTTP request.
 * @param {string} templateId - Template ID
 * @param {Object} updates - Updates (name, tags, etc.)
 * @param {string} [locale] - Optional locale
 * @param {Object} [client] - Optional SendWithUs client
 * @returns {Promise<Object>} Update response
 */
async function updateTemplate (templateId, updates, locale, client) {
  const api = client || createClient()
  const url = locale
    ? `https://api.sendwithus.com/api/v1_0/templates/${templateId}/locales/${locale}`
    : `https://api.sendwithus.com/api/v1_0/templates/${templateId}`

  return new Promise((resolve, reject) => {
    restler.putJson(url, updates, {
      headers: {
        'X-SWU-API-KEY': api.API_KEY,
        'X-SWU-API-CLIENT': 'node-2.10.0'
      }
    }).once('complete', (result, response) => {
      if (response.statusCode === 200) {
        resolve(result)
      } else {
        const error = new Error(`Request failed with ${response.statusCode}`)
        error.statusCode = response.statusCode
        error.response = result
        reject(error)
      }
    })
  })
}

/**
 * Update a template version
 * Note: The sendwithus package doesn't have a direct method for this.
 * We'll need to make a custom HTTP request.
 * @param {string} templateId - Template ID
 * @param {string} versionId - Version ID
 * @param {Object} updates - Updates (name, subject, html, text, etc.)
 * @param {string} [locale] - Optional locale
 * @param {Object} [client] - Optional SendWithUs client
 * @returns {Promise<Object>} Updated version object
 */
async function updateTemplateVersion (templateId, versionId, updates, locale, client) {
  const api = client || createClient()
  const url = locale
    ? `https://api.sendwithus.com/api/v1_0/templates/${templateId}/locales/${locale}/versions/${versionId}`
    : `https://api.sendwithus.com/api/v1_0/templates/${templateId}/versions/${versionId}`

  return new Promise((resolve, reject) => {
    restler.putJson(url, updates, {
      headers: {
        'X-SWU-API-KEY': api.API_KEY,
        'X-SWU-API-CLIENT': 'node-2.10.0'
      }
    }).once('complete', (result, response) => {
      if (response.statusCode === 200) {
        resolve(result)
      } else {
        const error = new Error(`Request failed with ${response.statusCode}`)
        error.statusCode = response.statusCode
        error.response = result
        reject(error)
      }
    })
  })
}

/**
 * Get all snippets
 * Note: The sendwithus package doesn't have a direct method for this.
 * We'll need to make a custom HTTP request.
 * @param {Object} [client] - Optional SendWithUs client
 * @returns {Promise<Array>} List of snippets
 */
async function getSnippets (client) {
  const api = client || createClient()
  const url = 'https://api.sendwithus.com/api/v1_0/snippets'

  return new Promise((resolve, reject) => {
    restler.get(url, {
      headers: {
        'X-SWU-API-KEY': api.API_KEY,
        'X-SWU-API-CLIENT': 'node-2.10.0'
      }
    }).once('complete', (result, response) => {
      if (response.statusCode === 200) {
        resolve(result)
      } else {
        const error = new Error(`Request failed with ${response.statusCode}`)
        error.statusCode = response.statusCode
        error.response = result
        reject(error)
      }
    })
  })
}

/**
 * Get a specific snippet
 * Note: The sendwithus package doesn't have a direct method for this.
 * We'll need to make a custom HTTP request.
 * @param {string} snippetId - Snippet ID
 * @param {Object} [client] - Optional SendWithUs client
 * @returns {Promise<Object>} Snippet object
 */
async function getSnippet (snippetId, client) {
  const api = client || createClient()
  const url = `https://api.sendwithus.com/api/v1_0/snippets/${snippetId}`

  return new Promise((resolve, reject) => {
    restler.get(url, {
      headers: {
        'X-SWU-API-KEY': api.API_KEY,
        'X-SWU-API-CLIENT': 'node-2.10.0'
      }
    }).once('complete', (result, response) => {
      if (response.statusCode === 200) {
        resolve(result)
      } else {
        const error = new Error(`Request failed with ${response.statusCode}`)
        error.statusCode = response.statusCode
        error.response = result
        reject(error)
      }
    })
  })
}

/**
 * Create a new snippet
 * Note: The sendwithus package doesn't have a direct method for this.
 * We'll need to make a custom HTTP request.
 * @param {Object} snippetData - Snippet data (name, body)
 * @param {Object} [client] - Optional SendWithUs client
 * @returns {Promise<Object>} Created snippet object
 */
async function createSnippet (snippetData, client) {
  const api = client || createClient()
  const url = 'https://api.sendwithus.com/api/v1_0/snippets'

  return new Promise((resolve, reject) => {
    restler.postJson(url, snippetData, {
      headers: {
        'X-SWU-API-KEY': api.API_KEY,
        'X-SWU-API-CLIENT': 'node-2.10.0'
      }
    }).once('complete', (result, response) => {
      if (response.statusCode === 200) {
        resolve(result)
      } else {
        const error = new Error(`Request failed with ${response.statusCode}`)
        error.statusCode = response.statusCode
        error.response = result
        reject(error)
      }
    })
  })
}

/**
 * Update a snippet
 * Note: The sendwithus package doesn't have a direct method for this.
 * We'll need to make a custom HTTP request.
 * @param {string} snippetId - Snippet ID
 * @param {Object} updates - Updates (name, body)
 * @param {Object} [client] - Optional SendWithUs client
 * @returns {Promise<Object>} Update response
 */
async function updateSnippet (snippetId, updates, client) {
  const api = client || createClient()
  const url = `https://api.sendwithus.com/api/v1_0/snippets/${snippetId}`

  return new Promise((resolve, reject) => {
    restler.putJson(url, updates, {
      headers: {
        'X-SWU-API-KEY': api.API_KEY,
        'X-SWU-API-CLIENT': 'node-2.10.0'
      }
    }).once('complete', (result, response) => {
      if (response.statusCode === 200) {
        resolve(result)
      } else {
        const error = new Error(`Request failed with ${response.statusCode}`)
        error.statusCode = response.statusCode
        error.response = result
        reject(error)
      }
    })
  })
}

/**
 * Download .pot translation package
 * Note: The sendwithus package doesn't have a direct method for this.
 * We'll need to make a custom HTTP request.
 * @param {string} tag - Tag to filter templates
 * @param {Object} [client] - Optional SendWithUs client
 * @returns {Promise<string>} .pot file content
 */
async function downloadPotFile (tag, client) {
  const api = client || createClient()
  const url = `https://api.sendwithus.com/api/v1_0/i18n/pot/${tag}`

  return new Promise((resolve, reject) => {
    restler.get(url, {
      headers: {
        'X-SWU-API-KEY': api.API_KEY,
        'X-SWU-API-CLIENT': 'node-2.10.0',
        Accept: 'text/plain'
      }
    }).once('complete', (result, response) => {
      if (response.statusCode === 200) {
        resolve(typeof result === 'string' ? result : JSON.stringify(result))
      } else {
        const error = new Error(`Request failed with ${response.statusCode}`)
        error.statusCode = response.statusCode
        error.response = result
        reject(error)
      }
    })
  })
}

/**
 * Upload .po translation files
 * Note: The sendwithus package doesn't have a direct method for this.
 * We'll need to make a custom HTTP request.
 * @param {string} tag - Tag for templates
 * @param {Buffer} zipBuffer - ZIP file buffer containing .po files
 * @param {Object} [client] - Optional SendWithUs client
 * @returns {Promise<Object>} Upload response
 */
async function uploadPoFiles (tag, zipBuffer, client) {
  const api = client || createClient()
  const url = `https://api.sendwithus.com/api/v1_0/i18n/po/${tag}`

  return new Promise((resolve, reject) => {
    // Use multipart/form-data with form-data library
    let FormData
    try {
      FormData = require('form-data')
    } catch (err) {
      // If form-data not available, try raw binary
      console.warn('form-data not found, trying raw binary upload')
      restler.post(url, {
        data: zipBuffer,
        headers: {
          'X-SWU-API-KEY': api.API_KEY,
          'X-SWU-API-CLIENT': 'node-2.10.0',
          'Content-Type': 'application/zip',
          'Content-Length': zipBuffer.length.toString()
        }
      }).once('complete', (result, response) => {
        if (response.statusCode === 200 || response.statusCode === 201) {
          resolve(result || {})
        } else {
          const error = new Error(`Request failed with ${response.statusCode}`)
          error.statusCode = response.statusCode
          error.response = result
          reject(error)
        }
      }).on('error', (err) => {
        reject(err)
      })
      return
    }

    // Use FormData for multipart upload
    const form = new FormData()
    form.append('file', zipBuffer, {
      filename: 'translations.zip',
      contentType: 'application/zip'
    })

    const formHeaders = form.getHeaders()
    const headers = {
      'X-SWU-API-KEY': api.API_KEY,
      'X-SWU-API-CLIENT': 'node-2.10.0',
      ...formHeaders
    }

    // Use form-data's submit method which handles streaming properly
    form.submit({
      protocol: 'https:',
      host: 'api.sendwithus.com',
      path: `/api/v1_0/i18n/po/${tag}`,
      method: 'POST',
      headers
    }, (err, res) => {
      if (err) {
        reject(err)
        return
      }

      let responseData = ''
      res.on('data', (chunk) => {
        responseData += chunk.toString()
      })

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const parsed = responseData ? JSON.parse(responseData) : {}
            resolve(parsed)
          } catch (e) {
            resolve({})
          }
        } else {
          const error = new Error(`Request failed with ${res.statusCode}`)
          error.statusCode = res.statusCode
          error.response = responseData
          reject(error)
        }
      })

      res.on('error', (err) => {
        reject(err)
      })
    })
  })
}

module.exports = {
  createClient,
  promisifyCall,
  getTemplates,
  getTemplate,
  getTemplateVersions,
  getTemplateVersion,
  createTemplate,
  updateTemplate,
  updateTemplateVersion,
  getSnippets,
  getSnippet,
  createSnippet,
  updateSnippet,
  downloadPotFile,
  uploadPoFiles
}
