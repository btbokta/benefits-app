/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@benefits-agent/shared'],
  // Allow importing JSON from packages/shared/src/seed
  webpack: (config) => {
    config.module.rules.push({
      test: /\.json$/,
      type: 'json',
    });
    return config;
  },
};

module.exports = nextConfig;
