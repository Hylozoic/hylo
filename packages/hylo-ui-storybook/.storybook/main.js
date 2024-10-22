import { join, dirname } from "path";
import { mergeConfig, defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import { patchCssModules } from 'vite-css-modules'

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, "package.json")));
}

/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: [
    {
      directory: '../../../apps',
      files: '*/src/**/*.stories.@(js|jsx|mjs|ts|tsx)'
    },
    {
      directory: '../../',
      files: '*/src/**/*.stories.@(js|jsx|mjs|ts|tsx)'
    }
  ],
  addons: [
    getAbsolutePath("@storybook/addon-onboarding"),
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@storybook/addon-essentials"),
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-interactions"),
  ],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
  viteFinal: async (config) => {
    return mergeConfig(config, {
      resolve: {
        alias: {
          // Add any necessary aliases here
        },
      },
      css: {
        // preprocessorOptions: {
        //   scss: {
        //     additionalData: `@import "../../../apps/web/src/css/global/sass_resources.scss";`,
        //   },
        // },
        preprocessorOptions: {
          scss: {
            additionalData: '@import "../../../apps/web/src/styles/global.scss";'
          }
        },
        modules: {
          localsConvention: 'camelCaseOnly',
          generateScopedName: '[name]_[local]_[hash:base64:5]'
        },
        postcss: {
          plugins: [
            tailwindcss,
            autoprefixer,
          ],
        },
      },
      optimizeDeps: {
        force: true,
        esbuildOptions: {
          loader: {
            '.js': 'jsx'
          }
        },
        exclude: ['@hylo/shared'],
        include: ['**/*.scss']
      },
      plugins: [
        patchCssModules(),
        react(),
        {
          name: 'treat-js-files-as-jsx',
          async transform (code, id) {
            if (!id.match(/src\/.*\.js$/)) return null
    
            // Use the exposed transform from vite, instead of directly
            // transforming with esbuild
            return transformWithEsbuild(code, id, {
              loader: 'jsx',
              jsx: 'automatic'
            })
          }
        },
      ],
    });
  },
};
export default config;
