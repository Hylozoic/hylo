import { join, dirname } from "path";
import { mergeConfig } from 'vite';

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
        preprocessorOptions: {
          scss: {
            additionalData: `@import "../../../apps/web/src/css/global/index.scss";`,
          },
        },
      },
      plugins: [
        // Add any necessary Vite plugins here
      ],
    });
  },
};
export default config;
