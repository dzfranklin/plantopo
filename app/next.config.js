/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'export',
};

const devConfig = {
  ...config,
  async rewrites() {
    return [
      {
        source: '/:any*',
        destination: '/',
      },
    ];
  },
};

module.exports = (phase) => {
  if (phase === 'phase-development-server') {
    return devConfig;
  } else {
    return config;
  }
};
