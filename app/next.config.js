/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'export',
};

module.exports = (phase) => {
  if (phase === 'phase-development-server') {
    return config;
  } else {
    return config;
  }
};
