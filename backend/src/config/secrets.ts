import { readFileSync } from 'fs';

export interface SecretsConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  encryptionKey: string;
  sessionSecret: string;
  databasePassword: string;
  redisPassword?: string;
  smtpPassword?: string;
}

/**
 * Secrets management for different environments
 * In production, secrets should be loaded from secure key management systems
 * like AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault
 */
class SecretsManager {
  private secrets: SecretsConfig;

  constructor() {
    this.secrets = this.loadSecrets();
  }

  private loadSecrets(): SecretsConfig {
    const env = process.env['NODE_ENV'] || 'development';

    switch (env) {
      case 'production':
        return this.loadProductionSecrets();
      case 'test':
        return this.loadTestSecrets();
      default:
        return this.loadDevelopmentSecrets();
    }
  }

  private loadDevelopmentSecrets(): SecretsConfig {
    return {
      jwtSecret: process.env['JWT_SECRET'] || 'dev-jwt-secret-key-for-development-only',
      jwtRefreshSecret: process.env['JWT_REFRESH_SECRET'] || 'dev-refresh-secret-key-for-development-only',
      encryptionKey: process.env['ENCRYPTION_KEY'] || 'dev-encryption-key-32-chars-123456',
      sessionSecret: process.env['SESSION_SECRET'] || 'dev-session-secret-for-development-only',
      databasePassword: process.env['DB_PASSWORD'] || 'PEPITO_SSO',
      redisPassword: process.env['REDIS_PASSWORD'] || '',
      smtpPassword: process.env['SMTP_PASSWORD'] || '',
    };
  }

  private loadTestSecrets(): SecretsConfig {
    return {
      jwtSecret: 'test-jwt-secret-key-for-testing-only',
      jwtRefreshSecret: 'test-refresh-secret-key-for-testing-only',
      encryptionKey: 'test-encryption-key-32-chars-12345',
      sessionSecret: 'test-session-secret-for-testing-only',
      databasePassword: 'test_password',
      redisPassword: '',
      smtpPassword: '',
    };
  }

  private loadProductionSecrets(): SecretsConfig {
    // In production, load secrets from secure key management systems
    // This is a simplified example - implement proper secret management

    const secretsPath = process.env['SECRETS_FILE_PATH'];
    if (secretsPath) {
      try {
        const secretsFile = readFileSync(secretsPath, 'utf8');
        const secrets = JSON.parse(secretsFile);
        return this.validateSecrets(secrets);
      } catch (error) {
        console.error('Failed to load secrets from file:', error);
      }
    }

    // Fallback to environment variables with validation
    const secrets = {
      jwtSecret: process.env['JWT_SECRET'] || '',
      jwtRefreshSecret: process.env['JWT_REFRESH_SECRET'] || '',
      encryptionKey: process.env['ENCRYPTION_KEY'] || '',
      sessionSecret: process.env['SESSION_SECRET'] || '',
      databasePassword: process.env['DB_PASSWORD'] || '',
      redisPassword: process.env['REDIS_PASSWORD'] || '',
      smtpPassword: process.env['SMTP_PASSWORD'] || '',
    };

    return this.validateSecrets(secrets);
  }

  private validateSecrets(secrets: any): SecretsConfig {
    const requiredSecrets = ['jwtSecret', 'jwtRefreshSecret', 'encryptionKey', 'sessionSecret', 'databasePassword'];
    
    for (const secret of requiredSecrets) {
      if (!secrets[secret as keyof SecretsConfig]) {
        throw new Error(`Missing required secret: ${secret}`);
      }
    }

    // Validate secret lengths for security
    if (secrets.jwtSecret!.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }

    if (secrets.jwtRefreshSecret!.length < 32) {
      throw new Error('JWT refresh secret must be at least 32 characters long');
    }

    if (secrets.encryptionKey!.length !== 32) {
      throw new Error('Encryption key must be exactly 32 characters long');
    }

    if (secrets.sessionSecret!.length < 32) {
      throw new Error('Session secret must be at least 32 characters long');
    }

    return secrets as SecretsConfig;
  }

  public getSecret(key: keyof SecretsConfig): string {
    const value = this.secrets[key];
    if (!value) {
      throw new Error(`Secret not found: ${key}`);
    }
    return value;
  }

  public getAllSecrets(): SecretsConfig {
    return { ...this.secrets };
  }

  // Method to rotate secrets (for production use)
  public async rotateSecret(key: keyof SecretsConfig, newValue: string): Promise<void> {
    // In production, this would integrate with your key management system
    this.secrets[key] = newValue as never;
    
    // Log secret rotation (without exposing the actual secret)
    console.log(`Secret rotated: ${key} at ${new Date().toISOString()}`);
  }

  // Method to check if secrets are expired (for production use)
  public isSecretExpired(_key: keyof SecretsConfig): boolean {
    // Implementation would depend on your key management system
    // This is a placeholder for the concept
    return false;
  }
}

// Singleton instance
export const secretsManager = new SecretsManager();

// Convenience exports
export const getSecret = (key: keyof SecretsConfig): string => secretsManager.getSecret(key);
export const getAllSecrets = (): SecretsConfig => secretsManager.getAllSecrets();