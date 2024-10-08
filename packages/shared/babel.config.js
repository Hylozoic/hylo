module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        // Prevents Babel from transpiling ES modules to CommonJS
        modules: false,
        targets: {
          node: 'current'  // Adjust this if necessary based on your Node.js target
        }
      }
    ]
  ],
  // This section is specifically for running tests with Jest
  env: {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            // In test environments, Babel can transpile modules to CommonJS
            modules: 'commonjs'
          }
        ]
      ]
    }
  }
}
