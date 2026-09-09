import dotenv from 'dotenv';
import path from 'path';

// Load environment-specific .env file
const envFile = `.env.${process.env['NODE_ENV'] || 'development'}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Also load default .env if it exists
dotenv.config();

export interface Config {
  // Server Configuration
  nodeEnv: string;
  port: number;
  host: string;
  corsOrigin: string | string[];
  trustProxy: boolean;

  // Database Configuration
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
    maxConnections: number;
  };

  // Redis Configuration
  redis: {
    host: string;
    port: number;
    password: string | undefined;
    db: number;
    ttl: number;
  };

  // JWT Configuration
  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    issuer: string;
    audience: string;
  };

  // Session Configuration
  session: {
    secret: string;
    timeout: number;
    cleanupInterval: number;
  };

  // Encryption Configuration
  encryption: {
    key: string;
    algorithm: string;
  };

  // Logging Configuration
  logging: {
    level: string;
    filePath: string;
    maxSize: string;
    maxFiles: number;
  };

  // Security Configuration
  security: {
    bcryptRounds: number;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    maxLoginAttempts: number;
    lockoutTime: number;
  };

  // Monitoring Configuration
  monitoring: {
    enabled: boolean;
    port: number | undefined;
    healthCheckInterval: number;
  };

  // Audit Configuration
  audit: {
    retentionDays: number;
    compression: boolean;
    cleanupInterval: number;
  };

  // Email Configuration
  email: {
    host: string | undefined;
    port: number | undefined;
    user: string | undefined;
    password: string | undefined;
    from: string | undefined;
    tls: boolean | undefined;
  };
}

function parseStringArray(value?: string): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function parseBoolean(value?: string, defaultValue = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const config: Config = {
  // Server Configuration
  nodeEnv: process.env['NODE_ENV'] || 'development',
  port: parseNumber(process.env['PORT'], 3001),
  host: process.env['HOST'] || 'localhost',
  corsOrigin: process.env['CORS_ORIGIN'] 
    ? (process.env['CORS_ORIGIN'].includes(',') 
        ? parseStringArray(process.env['CORS_ORIGIN'])
        : process.env['CORS_ORIGIN'])
    : 'http://localhost:3000',
  trustProxy: parseBoolean(process.env['TRUST_PROXY'], false),

  // Database Configuration
  database: {
    host: process.env['DB_HOST'] || '192.168.85.29',
    port: parseNumber(process.env['DB_PORT'], 1433),
    name: process.env['DB_NAME'] || 'SSO_PPT',
    user: process.env['DB_USER'] || 'PEPITO_SSO',
    password: process.env['DB_PASSWORD'] || 'PEPITO_SSO',
    ssl: parseBoolean(process.env['DB_SSL'], false),
    maxConnections: parseNumber(process.env['DB_MAX_CONNECTIONS'], 20),
  },

  // Redis Configuration
  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseNumber(process.env['REDIS_PORT'], 6379),
    password: process.env['REDIS_PASSWORD'] || undefined,
    db: parseNumber(process.env['REDIS_DB'], 0),
    ttl: parseNumber(process.env['REDIS_TTL'], 3600),
  },

  // JWT Configuration
  jwt: {
    secret: process.env['JWT_SECRET'] || 'dev-jwt-secret-key-for-development-only',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] || 'dev-refresh-secret-key-for-development-only',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '1h',
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d',
    issuer: process.env['JWT_ISSUER'] || 'enterprise-sso-system',
    audience: process.env['JWT_AUDIENCE'] || 'sso-users',
  },

  // Session Configuration
  session: {
    secret: process.env['SESSION_SECRET'] || 'dev-session-secret-for-development-only',
    timeout: parseNumber(process.env['SESSION_TIMEOUT'], 3600),
    cleanupInterval: parseNumber(process.env['SESSION_CLEANUP_INTERVAL'], 300),
  },

  // Encryption Configuration
  encryption: {
    key: process.env['ENCRYPTION_KEY'] || 'dev-encryption-key-32-chars-123456',
    algorithm: process.env['ENCRYPTION_ALGORITHM'] || 'aes-256-gcm',
  },

  // Logging Configuration
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
    filePath: process.env['LOG_FILE_PATH'] || './logs',
    maxSize: process.env['LOG_MAX_SIZE'] || '10m',
    maxFiles: parseNumber(process.env['LOG_MAX_FILES'], 5),
  },

  // Security Configuration
  security: {
    bcryptRounds: parseNumber(process.env['BCRYPT_ROUNDS'], 12),
    rateLimitWindowMs: parseNumber(process.env['RATE_LIMIT_WINDOW_MS'], 900000), // 15 minutes
    rateLimitMaxRequests: parseNumber(process.env['RATE_LIMIT_MAX_REQUESTS'], 100),
    maxLoginAttempts: parseNumber(process.env['MAX_LOGIN_ATTEMPTS'], 5),
    lockoutTime: parseNumber(process.env['LOCKOUT_TIME'], 300000), // 5 minutes
  },

  // Monitoring Configuration
  monitoring: {
    enabled: parseBoolean(process.env['METRICS_ENABLED'], true),
    port: process.env['METRICS_PORT'] ? parseNumber(process.env['METRICS_PORT'], 9090) : undefined,
    healthCheckInterval: parseNumber(process.env['HEALTH_CHECK_INTERVAL'], 30000),
  },

  // Audit Configuration
  audit: {
    retentionDays: parseNumber(process.env['AUDIT_LOG_RETENTION_DAYS'], 365),
    compression: parseBoolean(process.env['AUDIT_LOG_COMPRESSION'], true),
    cleanupInterval: parseNumber(process.env['AUDIT_CLEANUP_INTERVAL'], 86400), // 24 hours
  },

  // Email Configuration
  email: {
    host: process.env['SMTP_HOST'] || undefined,
    port: process.env['SMTP_PORT'] ? parseNumber(process.env['SMTP_PORT'], 587) : undefined,
    user: process.env['SMTP_USER'] || undefined,
    password: process.env['SMTP_PASSWORD'] || undefined,
    from: process.env['SMTP_FROM'] || undefined,
    tls: parseBoolean(process.env['SMTP_TLS'], true),
  },
};

// Validate critical configuration in production
if (config.nodeEnv === 'production') {
  const requiredConfig = [
    'database.password',
    'jwt.secret',
    'jwt.refreshSecret',
    'encryption.key',
    'session.secret',
  ];

  for (const configPath of requiredConfig) {
    const value = configPath.split('.').reduce((obj, key) => obj && obj[key], config as any);
    if (!value || (typeof value === 'string' && value.includes('dev-'))) {
      throw new Error(`Missing or insecure production configuration: ${configPath}`);
    }
  }

  // Additional production validations
  if (config.jwt.secret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters in production');
  }

  if (config.encryption.key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 characters in production');
  }
}