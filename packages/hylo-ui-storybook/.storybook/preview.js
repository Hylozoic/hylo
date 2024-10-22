/** @type { import('@storybook/react').Preview } */
// import '../../../apps/web/src/css/global/index.scss'
import '../../../apps/web/src/styles/global.css'


const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
