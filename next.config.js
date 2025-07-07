/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Enable experimental features for Next.js 15.3.5
  experimental: {
    // Enable Next.js 15+ app router optimizations
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
  },
  
  // Turbopack configuration (stable in Next.js 15)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  // Compiler options for better performance
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleapis.com',
      },
    ],
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
  
  // Redirects for better SEO
  async redirects() {
    return [
      {
        source: '/demo',
        destination: '/auth/login',
        permanent: true,
      },
    ];
  },
  
  // Bundle analyzer for development
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add SVG support
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    
    // Optimize bundle size
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            chunks: 'all',
            priority: 20,
          },
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|lucide-react)[\\/]/,
            name: 'ui',
            chunks: 'all',
            priority: 15,
          },
        },
      };
    }
    
    return config;
  },
  
  // Environment variables
  env: {
    CUSTOM_KEY: 'learning-assistant',
  },
  
  // Enable static exports for specific pages
  trailingSlash: false,
  
  // PoweredByHeader disabled for security
  poweredByHeader: false,
  
  // Compression enabled
  compress: true,
  
  // ESLint configuration
  eslint: {
    dirs: ['src', 'app'],
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
  
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },
};

// Bundle analyzer for production builds
if (process.env.ANALYZE === 'true') {
  const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
  module.exports = withBundleAnalyzer(nextConfig);
} else {
  module.exports = nextConfig;
}