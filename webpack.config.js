const path = require('path');
const webpack = require('webpack');
const CompressionPlugin = require('compression-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

// Advanced webpack optimizations for development and production
const createWebpackConfig = (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
  // Advanced performance optimizations
  const performanceConfig = {
    // Performance hints
    performance: {
      hints: dev ? false : 'warning',
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
      assetFilter: (assetFilename) => {
        return !assetFilename.endsWith('.map');
      }
    },
    
    // Optimization configuration
    optimization: {
      ...config.optimization,
      
      // Enable aggressive splitting for better caching
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxSize: dev ? 0 : 244000,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        enforceSizeThreshold: 50000,
        cacheGroups: {
          // Default cache groups
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
            enforce: false
          },
          
          // Vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            reuseExistingChunk: true,
            enforce: true
          },
          
          // React ecosystem
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            chunks: 'all',
            priority: 30,
            enforce: true
          },
          
          // UI Libraries
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|framer-motion)[\\/]/,
            name: 'ui',
            chunks: 'all',
            priority: 25,
            enforce: true
          },
          
          // Utility libraries
          utils: {
            test: /[\\/]node_modules[\\/](lodash|date-fns|uuid|axios)[\\/]/,
            name: 'utils',
            chunks: 'all',
            priority: 20,
            enforce: true
          },
          
          // Authentication libraries
          auth: {
            test: /[\\/]node_modules[\\/](@supabase|better-auth|jsonwebtoken)[\\/]/,
            name: 'auth',
            chunks: 'all',
            priority: 15,
            enforce: true
          },
          
          // Common modules
          common: {
            name: 'common',
            minChunks: 2,
            priority: 10,
            chunks: 'all',
            reuseExistingChunk: true,
            enforce: false
          }
        }
      },
      
      // Module concatenation for better tree shaking
      concatenateModules: !dev,
      
      // Better module ids
      moduleIds: dev ? 'named' : 'deterministic',
      chunkIds: dev ? 'named' : 'deterministic',
      
      // Production optimizations
      ...(dev ? {} : {
        minimizer: [
          // SWC minification is handled by Next.js
          ...config.optimization.minimizer || [],
        ],
        
        // Tree shaking
        usedExports: true,
        sideEffects: false,
        
        // Dead code elimination
        innerGraph: true,
        providedExports: true,
        mangleExports: true,
        
        // Runtime chunk optimization
        runtimeChunk: {
          name: 'webpack-runtime'
        }
      })
    }
  };
  
  // Cache configuration
  const cacheConfig = {
    cache: dev ? {
      type: 'memory',
      maxGenerations: 2,
      cacheUnaffected: true
    } : {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename]
      },
      cacheDirectory: path.resolve('.next/cache/webpack'),
      compression: 'gzip',
      hashAlgorithm: 'xxhash64',
      store: 'pack',
      version: buildId
    }
  };
  
  // Resolve optimizations
  const resolveConfig = {
    resolve: {
      ...config.resolve,
      
      // Faster module resolution
      cacheWithContext: false,
      unsafeCache: /node_modules/,
      
      // Extension resolution order
      extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
      
      // Module resolution optimization
      modules: ['node_modules', path.resolve('src')],
      
      // Alias optimizations
      alias: {
        ...config.resolve.alias,
        
        // Development aliases for better performance
        ...(dev ? {
          'react-dom$': 'react-dom/profiling',
          'scheduler/tracing': 'scheduler/tracing-profiling'
        } : {})
      },
      
      // Symlink handling
      symlinks: false,
      
      // Fallback for Node.js modules
      fallback: {
        ...config.resolve.fallback,
        
        // Additional fallbacks for better browser compatibility
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
        util: require.resolve('util'),
        assert: require.resolve('assert'),
        url: require.resolve('url'),
        path: require.resolve('path-browserify'),
        crypto: require.resolve('crypto-browserify'),
        os: require.resolve('os-browserify/browser'),
        zlib: require.resolve('browserify-zlib'),
        querystring: require.resolve('querystring-es3'),
        vm: require.resolve('vm-browserify')
      }
    }
  };
  
  // Module optimizations
  const moduleConfig = {
    module: {
      ...config.module,
      
      // Unsafe cache for node_modules
      unsafeCache: /node_modules/,
      
      // Parser optimizations
      parser: {
        javascript: {
          commonjsMagicComments: true,
          dynamicImportMode: 'lazy',
          dynamicImportPrefetch: true,
          dynamicImportPreload: true
        }
      }
    }
  };
  
  // Plugin optimizations
  const plugins = [
    ...config.plugins,
    
    // Development plugins
    ...(dev ? [
      // Better error overlay
      new webpack.HotModuleReplacementPlugin(),
      
      // Build progress
      new webpack.ProgressPlugin({
        activeModules: false,
        entries: true,
        modules: true,
        modulesCount: 5000,
        profile: false,
        dependencies: true,
        dependenciesCount: 10000,
        percentBy: null
      })
    ] : []),
    
    // Production plugins
    ...(!dev ? [
      // Compression
      new CompressionPlugin({
        filename: '[path][base].gz',
        algorithm: 'gzip',
        test: /\.(js|css|html|svg)$/,
        threshold: 8192,
        minRatio: 0.8
      }),
      
      // Bundle analysis (only when ANALYZE=true)
      ...(process.env.ANALYZE === 'true' ? [
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: 'bundle-analysis.html',
          openAnalyzer: false,
          generateStatsFile: true,
          statsFilename: 'bundle-stats.json',
          logLevel: 'info'
        })
      ] : []),
      
      // Define plugin for production flags
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify('production'),
        '__DEV__': false,
        '__BROWSER__': !isServer
      })
    ] : [])
  ];
  
  // Snapshot optimization
  const snapshotConfig = {
    snapshot: {
      managedPaths: [
        path.resolve('node_modules')
      ],
      immutablePaths: [
        path.resolve('node_modules')
      ],
      buildDependencies: {
        hash: true,
        timestamp: true
      },
      module: {
        timestamp: true,
        hash: true
      },
      resolve: {
        timestamp: true,
        hash: true
      },
      resolveBuildDependencies: {
        timestamp: true,
        hash: true
      }
    }
  };
  
  // Experiments
  const experimentsConfig = {
    experiments: {
      ...config.experiments,
      
      // Enable webpack 5 features
      topLevelAwait: true,
      asyncWebAssembly: true,
      
      // Build optimization
      buildHttp: false,
      lazyCompilation: dev ? {
        imports: true,
        entries: false
      } : false,
      
      // Output optimization
      outputModule: false
    }
  };
  
  // Watch options for development
  const watchConfig = dev ? {
    watchOptions: {
      ignored: [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**'
      ],
      aggregateTimeout: 200,
      poll: false
    }
  } : {};
  
  // Ignore warnings configuration
  const ignoreWarningsConfig = {
    ignoreWarnings: [
      // Ignore OpenTelemetry instrumentation warnings
      {
        module: /@opentelemetry\/instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
      // Ignore Sentry's OpenTelemetry integration warnings
      {
        module: /@sentry\/.*\/node_modules\/@opentelemetry\/instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
      // Ignore Prisma instrumentation warnings
      {
        module: /@prisma\/instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
      // Generic filter for OpenTelemetry warnings
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
    ]
  };

  // Stats configuration
  const statsConfig = {
    stats: dev ? 'errors-warnings' : {
      preset: 'normal',
      moduleAssets: false,
      excludeAssets: [/\.map$/, /^\.next\/static\/chunks\/webpack\-/],
      groupAssetsByInfo: false,
      groupAssetsByPath: false,
      groupAssetsByChunk: false,
      groupAssetsByExtension: false,
      groupAssetsByEmitStatus: false,
      groupModulesByPath: false,
      groupModulesByExtension: false,
      groupModulesByAttributes: false,
      groupModulesByCacheStatus: false,
      groupModulesByLayer: false,
      groupModulesByType: false,
      groupReasonsBy: false,
      usedExports: false,
      providedExports: false,
      optimizationBailout: false,
      reasons: false,
      children: false,
      source: false,
      moduleTrace: false,
      errorStack: false,
      errorDetails: false,
      hash: false,
      version: false,
      timings: true,
      builtAt: false,
      assets: false,
      modules: false,
      chunks: false,
      chunkModules: false,
      chunkOrigins: false,
      entrypoints: false,
      chunkGroups: false,
      warnings: true,
      warningsCount: true,
      errors: true,
      errorsCount: true,
      colors: true,
      performance: true,
      env: false,
      outputPath: false,
      publicPath: false
    }
  };
  
  // Infrastructure logging
  const infrastructureLogging = {
    infrastructureLogging: {
      level: dev ? 'info' : 'warn',
      debug: dev ? /webpack/ : false
    }
  };
  
  // Apply all configurations
  return {
    ...config,
    ...performanceConfig,
    ...cacheConfig,
    ...resolveConfig,
    ...moduleConfig,
    ...snapshotConfig,
    ...experimentsConfig,
    ...watchConfig,
    ...ignoreWarningsConfig,
    ...statsConfig,
    ...infrastructureLogging,
    plugins
  };
};

module.exports = createWebpackConfig;