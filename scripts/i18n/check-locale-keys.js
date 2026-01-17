#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  readJson,
  isPlainObject,
  pathToString,
  extractPlaceholders
} = require('./lib');

function usage () {
  console.error('Usage: node scripts/i18n/check-locale-keys.js <english-locale> [other-locale|dir ...]');
  console.error('If no other paths are provided, all sibling *.json files will be checked.');
  process.exit(1);
}

function describeType (value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

const args = process.argv.slice(2);
if (args.length === 0) usage();

const [englishPathRaw, ...targetArgs] = args;
const englishPath = path.resolve(process.cwd(), englishPathRaw);

if (!fs.existsSync(englishPath)) {
  console.error(`File not found: ${englishPath}`);
  process.exit(1);
}

let english;
try {
  english = readJson(englishPath);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

if (!isPlainObject(english)) {
  console.error('English locale must be a JSON object.');
  process.exit(1);
}

const englishDir = path.dirname(englishPath);
const targets = new Set();

if (targetArgs.length === 0) {
  for (const name of fs.readdirSync(englishDir)) {
    if (!name.endsWith('.json')) continue;
    const fullPath = path.join(englishDir, name);
    if (path.resolve(fullPath) === englishPath) continue;
    targets.add(fullPath);
  }
} else {
  for (const target of targetArgs) {
    const fullPath = path.resolve(process.cwd(), target);
    if (!fs.existsSync(fullPath)) {
      console.error(`Missing locale path: ${fullPath}`);
      process.exit(1);
    }
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      for (const name of fs.readdirSync(fullPath)) {
        if (!name.endsWith('.json')) continue;
        targets.add(path.join(fullPath, name));
      }
    } else {
      targets.add(fullPath);
    }
  }
}

if (targets.size === 0) {
  console.log('No translation files to check.');
  process.exit(0);
}

function compareNodes (englishNode, translationNode, pathSegments, issues) {
  const pathLabel = pathToString(pathSegments);

  if (isPlainObject(englishNode)) {
    if (translationNode === undefined) {
      issues.missing.push(pathLabel);
      return;
    }
    if (!isPlainObject(translationNode)) {
      issues.typeMismatch.push({ path: pathLabel, expected: 'object', actual: describeType(translationNode) });
      return;
    }
    const englishKeys = new Set(Object.keys(englishNode));
    for (const key of englishKeys) {
      compareNodes(
        englishNode[key],
        translationNode?.[key],
        pathSegments.concat(key),
        issues
      );
    }
    for (const extraKey of Object.keys(translationNode)) {
      if (englishKeys.has(extraKey)) continue;
      issues.extra.push(pathToString(pathSegments.concat(extraKey)));
    }
    return;
  }

  if (Array.isArray(englishNode)) {
    if (translationNode === undefined) {
      issues.missing.push(pathLabel);
      return;
    }
    if (!Array.isArray(translationNode)) {
      issues.typeMismatch.push({ path: pathLabel, expected: 'array', actual: describeType(translationNode) });
      return;
    }
    if (englishNode.length !== translationNode.length) {
      issues.lengthMismatch.push({ path: pathLabel, expected: englishNode.length, actual: translationNode.length });
    }
    englishNode.forEach((item, index) => {
      compareNodes(item, translationNode[index], pathSegments.concat(String(index)), issues);
    });
    return;
  }

  if (typeof englishNode !== 'string') {
    if (translationNode === undefined) {
      issues.missing.push(pathLabel);
    } else if (typeof translationNode !== typeof englishNode) {
      issues.typeMismatch.push({
        path: pathLabel,
        expected: typeof englishNode,
        actual: describeType(translationNode)
      });
    }
    return;
  }

  if (translationNode === undefined) {
    issues.missing.push(pathLabel);
    return;
  }

  if (typeof translationNode !== 'string') {
    issues.typeMismatch.push({ path: pathLabel, expected: 'string', actual: describeType(translationNode) });
    return;
  }

  const englishPlaceholders = extractPlaceholders(englishNode);
  const translationPlaceholders = extractPlaceholders(translationNode);
  const missingPlaceholders = [...englishPlaceholders].filter(ph => !translationPlaceholders.has(ph));
  const extraPlaceholders = [...translationPlaceholders].filter(ph => !englishPlaceholders.has(ph));

  if (missingPlaceholders.length || extraPlaceholders.length) {
    issues.placeholder.push({
      path: pathLabel,
      missing: missingPlaceholders,
      extra: extraPlaceholders
    });
  }
}

let hasErrors = false;
for (const targetPath of Array.from(targets).sort()) {
  let translation;
  try {
    translation = readJson(targetPath);
  } catch (err) {
    console.error(err.message);
    hasErrors = true;
    continue;
  }

  const issues = {
    missing: [],
    extra: [],
    typeMismatch: [],
    lengthMismatch: [],
    placeholder: []
  };

  compareNodes(english, translation, [], issues);

  const hasAny = Object.values(issues).some(arr => arr.length > 0);
  if (!hasAny) {
    console.log(`${targetPath}: OK`);
    continue;
  }

  hasErrors = true;
  console.log(`${targetPath}:`);
  if (issues.missing.length) {
    console.log(`  Missing (${issues.missing.length}):`);
    for (const pathLabel of issues.missing.sort()) console.log(`    ${pathLabel}`);
  }
  if (issues.extra.length) {
    console.log(`  Extra (${issues.extra.length}):`);
    for (const pathLabel of issues.extra.sort()) console.log(`    ${pathLabel}`);
  }
  if (issues.typeMismatch.length) {
    console.log(`  Type mismatch (${issues.typeMismatch.length}):`);
    for (const item of issues.typeMismatch.sort((a, b) => a.path.localeCompare(b.path))) {
      console.log(`    ${item.path} (expected ${item.expected}, found ${item.actual})`);
    }
  }
  if (issues.lengthMismatch.length) {
    console.log(`  Length mismatch (${issues.lengthMismatch.length}):`);
    for (const item of issues.lengthMismatch.sort((a, b) => a.path.localeCompare(b.path))) {
      console.log(`    ${item.path} (expected length ${item.expected}, found ${item.actual})`);
    }
  }
  if (issues.placeholder.length) {
    console.log(`  Placeholder issues (${issues.placeholder.length}):`);
    for (const item of issues.placeholder.sort((a, b) => a.path.localeCompare(b.path))) {
      if (item.missing.length) console.log(`    ${item.path} missing ${item.missing.join(', ')}`);
      if (item.extra.length) console.log(`    ${item.path} extra ${item.extra.join(', ')}`);
    }
  }
}

process.exit(hasErrors ? 1 : 0);
