#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { readJson, sortLocaleDeep } = require('./lib')

function usage () {
  console.error('Usage: node scripts/i18n/sort-locale.js <locale-file>')
  process.exit(1)
}

const [target] = process.argv.slice(2)
if (!target) usage()

const filePath = path.resolve(process.cwd(), target)

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`)
  process.exit(1)
}

let data
try {
  data = readJson(filePath)
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

if (data === null || typeof data !== 'object' || Array.isArray(data)) {
  console.error('Expected top-level JSON object with string keys.')
  process.exit(1)
}

const sorted = sortLocaleDeep(data)
fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n')
console.log(`Sorted keys written to ${filePath}`)
