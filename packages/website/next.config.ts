import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.devServer = {
        ...config.devServer,
        devMiddleware: {
          ...config.devServer?.devMiddleware,
          writeToDisk: true,
        },
      };
    }
    return config;
  },
};

export default nextConfig;
