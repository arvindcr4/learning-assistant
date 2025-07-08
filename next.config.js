// Required imports
const path = require('path');

// Temporarily disable Sentry for development builds
const sentryAvailable = false; // Disabled until properly configured
let withSentryConfig = null;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporarily disable React strict mode for deployment
  reactStrictMode: false,
  
  // Enable experimental features for Next.js 15.3.5
  experimental: {
    // Enable Next.js 15+ app router optimizations
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react', 'framer-motion'],
    // Enable stable experimental features only
    optimizeCss: true,
    // Temporarily disable these optimizations to fix build issues
    // webpackBuildWorker: true,
    // optimizeServerReact: true,
    // parallelServerBuildTraces: true,
    // memoryBasedWorkersCount: true,
  },
  
  // Server external packages (moved from experimental)
  serverExternalPackages: ['@opentelemetry/sdk-node'],
  
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
    // Temporarily disable console removal to avoid React issues
    // removeConsole: process.env.NODE_ENV === 'production',
    // Enable SWC minification for better performance
    styledComponents: true,
    // Temporarily disable React optimizations
    // reactRemoveProperties: process.env.NODE_ENV === 'production',
  },
  
  // Advanced image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudflare.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
    ],
  },
  
  // Security and performance headers
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
      // Static asset caching
      {
        source: '/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Image caching
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Font caching
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // API caching
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
  
  // Redirects for better SEO - temporarily disabled for debugging
  // async redirects() {
  //   return [
  //     {
  //       source: '/demo',
  //       destination: '/auth/login',
  //       permanent: true,
  //     },
  //     {
  //       source: '/en',
  //       destination: '/',
  //       permanent: true,
  //     },
  //     {
  //       source: '/en/:path*',
  //       destination: '/:path*',
  //       permanent: true,
  //     },
  //   ];
  // },
  
  // Advanced webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add SVG support
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    
    // Suppress OpenTelemetry instrumentation warnings
    config.ignoreWarnings = [
      // Ignore critical dependency warnings from OpenTelemetry instrumentation
      {
        module: /@opentelemetry\/instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
      // Ignore warnings from Sentry's OpenTelemetry integrations
      {
        module: /@sentry\/.*\/node_modules\/@opentelemetry\/instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
      // Ignore warnings from Prisma instrumentation
      {
        module: /@prisma\/instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
      // General OpenTelemetry warnings filter
      (warning) => {
        return (
          warning.message && 
          warning.message.includes('Critical dependency: the request of a dependency is an expression') &&
          warning.module &&
          typeof warning.module === 'string' &&
          (warning.module.includes('@opentelemetry/instrumentation') || 
           warning.module.includes('@sentry/') ||
           warning.module.includes('@prisma/instrumentation'))
        );
      },
    ];
    
    // Exclude server-only packages from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        child_process: false,
        worker_threads: false,
      };

      config.externals = config.externals || [];
      config.externals.push({
        // OpenTelemetry packages
        '@opentelemetry/sdk-node': 'commonjs @opentelemetry/sdk-node',
        '@opentelemetry/sdk-trace-node': 'commonjs @opentelemetry/sdk-trace-node',
        '@opentelemetry/exporter-otlp-http': 'commonjs @opentelemetry/exporter-otlp-http',
        '@opentelemetry/instrumentation': 'commonjs @opentelemetry/instrumentation',
        '@opentelemetry/resources': 'commonjs @opentelemetry/resources',
        '@opentelemetry/semantic-conventions': 'commonjs @opentelemetry/semantic-conventions',
        // Winston and logging packages
        'winston': 'commonjs winston',
        'winston-daily-rotate-file': 'commonjs winston-daily-rotate-file',
        'file-stream-rotator': 'commonjs file-stream-rotator',
        'winston-transport': 'commonjs winston-transport',
        'winston-logzio': 'commonjs winston-logzio',
        'winston-loggly-bulk': 'commonjs winston-loggly-bulk',
        'winston-elasticsearch': 'commonjs winston-elasticsearch',
        'winston-papertrail': 'commonjs winston-papertrail',
        'winston-syslog': 'commonjs winston-syslog',
      });
    }
    
    // Optimize bundle size with advanced code splitting
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
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
          animation: {
            test: /[\\/]node_modules[\\/](framer-motion|motion)[\\/]/,
            name: 'animation',
            chunks: 'all',
            priority: 10,
          },
          utils: {
            test: /[\\/]node_modules[\\/](lodash|date-fns|uuid)[\\/]/,
            name: 'utils',
            chunks: 'all',
            priority: 5,
          },
        },
      };
      
      // Enable module concatenation for better tree shaking
      config.optimization.concatenateModules = true;
      
      // Enable aggressive module splitting for better caching
      config.optimization.moduleIds = 'deterministic';
      config.optimization.chunkIds = 'deterministic';
    }
    
    // Performance optimizations
    if (!dev) {
      // Enable webpack bundle analyzer in production
      config.plugins.push(
        new webpack.DefinePlugin({
          __DEV__: JSON.stringify(false),
          'process.env.NODE_ENV': JSON.stringify('production'),
        })
      );
      
      // Tree shaking optimizations
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
      
      // Advanced optimization flags
      config.optimization.innerGraph = true;
      config.optimization.providedExports = true;
      config.optimization.mangleExports = true;
      
      // Enable persistent caching
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
        cacheDirectory: path.join(process.cwd(), '.next/cache/webpack'),
      };
    } else {
      // Development optimizations
      config.cache = {
        type: 'memory',
        maxGenerations: 2,
      };
      
      // Faster development builds
      config.optimization.moduleIds = 'named';
      config.optimization.chunkIds = 'named';
      
      // Reduce bundle size in development
      config.resolve.alias = {
        ...config.resolve.alias,
        // Use development versions of heavy libraries
        'react-dom$': 'react-dom/profiling',
        'scheduler/tracing': 'scheduler/tracing-profiling',
      };
    }
    
    // Memory optimization
    config.snapshot = {
      managedPaths: [path.join(process.cwd(), 'node_modules')],
      immutablePaths: [],
      buildDependencies: {
        hash: true,
        timestamp: true,
      },
    };
    
    // Resolve optimization
    config.resolve.cacheWithContext = false;
    config.resolve.unsafeCache = /node_modules/;
    
    // Module optimization
    config.module.unsafeCache = true;
    
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
  
  // Enable modularize imports for better tree shaking
  modularizeImports: {
    'lodash': {
      transform: 'lodash/{{member}}',
      preventFullImport: true,
    },
    'date-fns': {
      transform: 'date-fns/{{member}}',
      preventFullImport: true,
    },
    '@radix-ui/react-icons': {
      transform: '@radix-ui/react-icons/dist/{{member}}',
      preventFullImport: true,
    },
  },
  
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

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry Webpack plugin
  silent: true, // Suppresses all logs
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  
  // Disable source maps if not properly configured
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  
  // Disable sourcemaps generation and upload if Sentry is not configured
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
  
  // Source maps
  widenClientFileUpload: !!process.env.SENTRY_AUTH_TOKEN,
  transpileClientSDK: true,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: process.env.NODE_ENV === 'production',
  
  // Release tracking
  automaticVercelMonitors: !!process.env.VERCEL,
};

// Bundle analyzer for production builds
if (process.env.ANALYZE === 'true') {
  const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
  
  // Only add Sentry if properly configured
  if (sentryAvailable && withSentryConfig) {
    module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), sentryWebpackPluginOptions);
  } else {
    module.exports = withBundleAnalyzer(nextConfig);
  }
} else {
  // Only add Sentry if properly configured
  if (sentryAvailable && withSentryConfig) {
    module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
  } else {
    module.exports = nextConfig;
  }
}