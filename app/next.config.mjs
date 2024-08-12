/** @type {import('next').NextConfig} */
const devNextConfig = {
  async rewrites() {
    const endpoint = process.env.DEV_PROXY_API_ENDPOINT;
    return [
      {
        source: '/api/v1/:path*',
        destination: endpoint + ':path*',
      },
    ];
  },
};

/** @type {import('next').NextConfig} */
const prodNextConfig = {};

export default process.env.NODE_ENV === 'development'
  ? devNextConfig
  : prodNextConfig;
