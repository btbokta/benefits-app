import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@benefits-agent/shared'],
  experimental: {},
};

export default nextConfig;
