// Database Configuration
const fs = require('fs');
const path = require('path');

// SSL configuration helper
const getSSLConfig = (environment) => {
  const sslConfig = {
    require: process.env.DB_SSL_REQUIRE === 'true',
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  };

  // Add SSL certificates if provided
  if (process.env.DB_SSL_CA_PATH) {
    try {
      sslConfig.ca = fs.readFileSync(path.resolve(process.env.DB_SSL_CA_PATH));
    } catch (error) {
      console.warn(`Warning: Could not read SSL CA certificate from ${process.env.DB_SSL_CA_PATH}`);
    }
  }

  if (process.env.DB_SSL_CERT_PATH) {
    try {
      sslConfig.cert = fs.readFileSync(path.resolve(process.env.DB_SSL_CERT_PATH));
    } catch (error) {
      console.warn(`Warning: Could not read SSL certificate from ${process.env.DB_SSL_CERT_PATH}`);
    }
  }

  if (process.env.DB_SSL_KEY_PATH) {
    try {
      sslConfig.key = fs.readFileSync(path.resolve(process.env.DB_SSL_KEY_PATH));
    } catch (error) {
      console.warn(`Warning: Could not read SSL key from ${process.env.DB_SSL_KEY_PATH}`);
    }
  }

  return sslConfig;
};

// Validate required environment variables
const validateConfig = (config, environment) => {
  const required = ['host', 'database', 'username'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required database configuration for ${environment}: ${missing.join(', ')}`);
  }

  if (!config.password && environment !== 'development') {
    console.warn(`Warning: No database password provided for ${environment} environment`);
  }
};

const config = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'learning_assistant_dev',
    username: process.env.DB_USER || 'learning_user',
    password: process.env.DB_PASSWORD || '', // Remove default password
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      min: parseInt(process.env.DB_MIN_CONNECTIONS || '0'),
      acquire: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
      idle: parseInt(process.env.DB_IDLE_TIMEOUT || '10000'),
      handleDisconnects: true,
      evict: parseInt(process.env.DB_EVICT_TIMEOUT || '1000')
    },
    dialectOptions: {
      ssl: process.env.DB_SSL_REQUIRE === 'true' ? getSSLConfig('development') : false,
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
      idle_in_transaction_session_timeout: parseInt(process.env.DB_IDLE_TRANSACTION_TIMEOUT || '10000')
    },
    retry: {
      match: [
        /ECONNRESET/,
        /ENOTFOUND/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /TimeoutError/
      ],
      max: 3
    }
  },
  
  test: {
    host: process.env.DB_TEST_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_TEST_PORT || process.env.DB_PORT || '5432'),
    database: process.env.DB_TEST_NAME || process.env.DB_NAME || 'learning_assistant_test',
    username: process.env.DB_TEST_USER || process.env.DB_USER || 'learning_user',
    password: process.env.DB_TEST_PASSWORD || process.env.DB_PASSWORD || '',
    dialect: 'postgres',
    logging: false,
    pool: {
      max: parseInt(process.env.DB_TEST_MAX_CONNECTIONS || '5'),
      min: 0,
      acquire: 30000,
      idle: 10000,
      handleDisconnects: true,
      evict: 1000
    },
    dialectOptions: {
      ssl: process.env.DB_SSL_REQUIRE === 'true' ? getSSLConfig('test') : false,
      statement_timeout: 30000,
      query_timeout: 30000,
      idle_in_transaction_session_timeout: 10000
    },
    retry: {
      match: [
        /ECONNRESET/,
        /ENOTFOUND/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /TimeoutError/
      ],
      max: 3
    }
  },
  
  staging: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'postgres',
    logging: process.env.DB_LOGGING === 'true',
    pool: {
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '30'),
      min: parseInt(process.env.DB_MIN_CONNECTIONS || '5'),
      acquire: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
      idle: parseInt(process.env.DB_IDLE_TIMEOUT || '10000'),
      handleDisconnects: true,
      evict: parseInt(process.env.DB_EVICT_TIMEOUT || '1000')
    },
    dialectOptions: {
      ssl: getSSLConfig('staging'),
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000'),
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '60000'),
      idle_in_transaction_session_timeout: parseInt(process.env.DB_IDLE_TRANSACTION_TIMEOUT || '30000')
    },
    retry: {
      match: [
        /ECONNRESET/,
        /ENOTFOUND/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /TimeoutError/,
        /ConnectionError/
      ],
      max: 5
    }
  },
  
  production: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'postgres',
    logging: process.env.DB_LOGGING === 'true',
    pool: {
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '50'),
      min: parseInt(process.env.DB_MIN_CONNECTIONS || '10'),
      acquire: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
      idle: parseInt(process.env.DB_IDLE_TIMEOUT || '10000'),
      handleDisconnects: true,
      evict: parseInt(process.env.DB_EVICT_TIMEOUT || '1000')
    },
    dialectOptions: {
      ssl: getSSLConfig('production'),
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000'),
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '60000'),
      idle_in_transaction_session_timeout: parseInt(process.env.DB_IDLE_TRANSACTION_TIMEOUT || '30000')
    },
    retry: {
      match: [
        /ECONNRESET/,
        /ENOTFOUND/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /TimeoutError/,
        /ConnectionError/,
        /ConnectionTimedOutError/
      ],
      max: 5
    }
  }
};

// Validate configuration for current environment
const currentEnv = process.env.NODE_ENV || 'development';
if (config[currentEnv]) {
  try {
    validateConfig(config[currentEnv], currentEnv);
  } catch (error) {
    console.error(`Database configuration error: ${error.message}`);
    if (currentEnv === 'production') {
      process.exit(1);
    }
  }
}

module.exports = config;