module.exports = function (api) {
  if (api) {
    api.cache(true)
  }

  // const reactCSSModulesPlugin = [
  //   'react-css-modules',
  //   {
  //     // generateScopedName: sharedConfig.cssLoader.options.localIdentName,
  //     filetypes: {
  //       '.scss': 'postcss-scss'
  //     },
  //     exclude: 'node_modules',
  //     searchPaths: [
  //       'src'
  //     ]
  //   }
  // ]

  return {
    presets: [
      [
        '@babel/preset-env',
        { targets: { node: 'current' } }
      ],
      '@babel/preset-typescript',
      '@babel/preset-react',
      [
        'babel-preset-vite',
        {
          env: true,
          glob: false
        }
      ]
    ],
    plugins: [
      '@babel/plugin-transform-runtime',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-proposal-optional-chaining',
      '@babel/plugin-transform-private-methods',
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.graphql']
        }
      ],
      /*
        Disabling this by default: when it runs, it generates keys for missing translations
        It also sometimes overwrites newly added translations, causing a lot of finicky editing.
        When you add a new translation, uncomment the below config, restart webpack (yarn start) and it should pick up the key for every locale file
      */
      // [
      //   'i18next-extract',
      //   {
      //     keySeparator: null,
      //     locales: ['es', 'en'],
      //     nsSeparator: null,
      //     outputPath: 'public/locales/{{locale}}.json'
      //   }
      // ],
      'import-graphql',
      'inline-import',
      'lodash'
    ],
    // ignore: [
    //   paths.resolveApp('scripts/templates/*')
    // ],
    env: {
      development: {
        plugins: [
          // [
          //   reactCSSModulesPlugin[0],
          //   {
          //     ...reactCSSModulesPlugin[1],
          //     webpackHotModuleReloading: true
          //   }
          // ]
        ]
      },
      production: {
        plugins: [
          // reactCSSModulesPlugin
        ],
        compact: true
      },
      server: {
        plugins: [
          // reactCSSModulesPlugin
        ],
        compact: true
      }
    }
  }
}
