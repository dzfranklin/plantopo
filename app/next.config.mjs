/** @type {import('next').NextConfig} */
const devNextConfig = {};

/** @type {import('next').NextConfig} */
const prodNextConfig = {};

export default process.env.NODE_ENV === 'development'
  ? devNextConfig
  : prodNextConfig;
