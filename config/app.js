// Application Configuration
const config = {
  development: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || 'localhost',
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      message: 'Too many requests from this IP, please try again later.'
    },
    security: {
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10'),
      jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
      sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret'
    },
    logging: {
      level: process.env.LOG_LEVEL || 'debug',
      file: process.env.LOG_FILE || 'logs/app.log',
      maxSize: process.env.LOG_MAX_SIZE || '10m',
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5')
    },
    upload: {
      maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760'), // 10MB
      directory: process.env.UPLOAD_DIR || 'uploads',
      allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,pdf,doc,docx').split(',')
    }
  },
  
  test: {
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || 'localhost',
    cors: {
      origin: 'http://localhost:3001',
      credentials: true
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 1000,
      message: 'Too many requests from this IP, please try again later.'
    },
    security: {
      bcryptRounds: 8, // Lower for faster tests
      jwtSecret: 'test-secret-key',
      jwtExpiresIn: '1h',
      sessionSecret: 'test-session-secret'
    },
    logging: {
      level: 'error',
      file: 'logs/test.log',
      maxSize: '5m',
      maxFiles: 3
    },
    upload: {
      maxSize: 5242880, // 5MB
      directory: 'test-uploads',
      allowedTypes: ['jpg', 'jpeg', 'png', 'pdf']
    }
  },
  
  staging: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN,
      credentials: true
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      message: 'Too many requests from this IP, please try again later.'
    },
    security: {
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
      sessionSecret: process.env.SESSION_SECRET
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      file: process.env.LOG_FILE || 'logs/app.log',
      maxSize: process.env.LOG_MAX_SIZE || '50m',
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '10')
    },
    upload: {
      maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760'),
      directory: process.env.UPLOAD_DIR || 'uploads',
      allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,pdf,doc,docx').split(',')
    }
  },
  
  production: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN,
      credentials: true
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX || '50'),
      message: 'Too many requests from this IP, please try again later.'
    },
    security: {
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
      sessionSecret: process.env.SESSION_SECRET
    },
    logging: {
      level: process.env.LOG_LEVEL || 'warn',
      file: process.env.LOG_FILE || 'logs/app.log',
      maxSize: process.env.LOG_MAX_SIZE || '100m',
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '30')
    },
    upload: {
      maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760'),
      directory: process.env.UPLOAD_DIR || 'uploads',
      allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,pdf,doc,docx').split(',')
    }
  }
};

module.exports = config;