/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle PDF.js worker
    config.resolve.alias['pdfjs-dist/build/pdf.worker.entry'] = 
      'pdfjs-dist/build/pdf.worker.min.js';

    return config;
  },
}

module.exports = nextConfig
