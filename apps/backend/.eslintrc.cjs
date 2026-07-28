const pkg = require('./package.json')

const globals = Object.fromEntries(
  (pkg.standard?.global || []).map(name => [name, 'readonly'])
)

module.exports = {
  root: true,
  extends: ['standard'],
  globals,
  rules: pkg.standard?.rules || {},
  ignorePatterns: pkg.standard?.ignore || [],
  // Chai property assertions like `expect(x).to.exist` are valid and common in tests.
  overrides: [
    {
      files: [
        '**/*.test.js',
        'test/**/*.js'
      ],
      rules: {
        'no-unused-expressions': 'off'
      }
    }
  ]
}
