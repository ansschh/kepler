/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Disable node-specific modules in client-side code
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        canvas: false,
        path: false
      };
    }

    // Add environment variable to disable node canvas factory
    config.plugins.push(
      new config.webpack.DefinePlugin({
        'process.env.DISABLE_NODE_CANVAS_FACTORY': JSON.stringify('true')
      })
    );

    return config;
  }
};

export default nextConfig;
