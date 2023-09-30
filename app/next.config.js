/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  trailingSlash: true,
  output: 'export',
  transpilePackages: [
    '@tanstack/react-query-devtools',
    '@tanstack/react-query',
    '@adobe/react-spectrum',
    '@react-spectrum/actionbar',
    '@react-spectrum/actiongroup',
    '@react-spectrum/avatar',
    '@react-spectrum/badge',
    '@react-spectrum/breadcrumbs',
    '@react-spectrum/button',
    '@react-spectrum/buttongroup',
    '@react-spectrum/calendar',
    '@react-spectrum/checkbox',
    '@react-spectrum/combobox',
    '@react-spectrum/contextualhelp',
    '@react-spectrum/datepicker',
    '@react-spectrum/dialog',
    '@react-spectrum/divider',
    '@react-spectrum/dnd',
    '@react-spectrum/form',
    '@react-spectrum/icon',
    '@react-spectrum/illustratedmessage',
    '@react-spectrum/inlinealert',
    '@react-spectrum/image',
    '@react-spectrum/label',
    '@react-spectrum/labeledvalue',
    '@react-spectrum/layout',
    '@react-spectrum/link',
    '@react-spectrum/list',
    '@react-spectrum/listbox',
    '@react-spectrum/menu',
    '@react-spectrum/meter',
    '@react-spectrum/numberfield',
    '@react-spectrum/overlays',
    '@react-spectrum/picker',
    '@react-spectrum/progress',
    '@react-spectrum/provider',
    '@react-spectrum/radio',
    '@react-spectrum/slider',
    '@react-spectrum/searchfield',
    '@react-spectrum/statuslight',
    '@react-spectrum/switch',
    '@react-spectrum/table',
    '@react-spectrum/tabs',
    '@react-spectrum/tag',
    '@react-spectrum/text',
    '@react-spectrum/textfield',
    '@react-spectrum/theme-dark',
    '@react-spectrum/theme-default',
    '@react-spectrum/theme-light',
    '@react-spectrum/tooltip',
    '@react-spectrum/view',
    '@react-spectrum/well',
    '@spectrum-icons/illustrations',
    '@spectrum-icons/ui',
    '@spectrum-icons/workflow',
  ],
};

/** @type {import('next').NextConfig} */
const devConfig = {
  ...config,
  output: undefined,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/map/:id*',
          destination: '/map/__id__/',
        }
      ],
      afterFiles: [],
      fallback: [],
    }
  }
}

module.exports = (phase) => {
  if (phase === 'phase-development-server') {
    return devConfig;
  } else {
    return config;
  }
};
