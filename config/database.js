// Database Configuration
const config = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'learning_assistant_dev',
    username: process.env.DB_USER || 'learning_user',
    password: process.env.DB_PASSWORD || 'dev_password',
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      min: parseInt(process.env.DB_MIN_CONNECTIONS || '0'),
      acquire: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
      idle: parseInt(process.env.DB_IDLE_TIMEOUT || '10000')
    },
    dialectOptions: {
      ssl: false
    }
  },
  
  test: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'learning_assistant_test',
    username: process.env.DB_USER || 'learning_user',
    password: process.env.DB_PASSWORD || 'test_password',
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: false
    }
  },
  
  staging: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '30'),
      min: parseInt(process.env.DB_MIN_CONNECTIONS || '5'),
      acquire: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
      idle: parseInt(process.env.DB_IDLE_TIMEOUT || '10000')
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  },
  
  production: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '50'),
      min: parseInt(process.env.DB_MIN_CONNECTIONS || '10'),
      acquire: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
      idle: parseInt(process.env.DB_IDLE_TIMEOUT || '10000')
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
};

module.exports = config;