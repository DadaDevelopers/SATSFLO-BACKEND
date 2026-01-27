/**
 * Encryption Utility
 *
 * AES-256-GCM encryption for sensitive health data
 * HIPAA-compliant encryption at rest for medical information
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

class Encryption {
  /**
   * Encrypt sensitive data (health information, personal notes)
   * @param {string} text - Plain text to encrypt
   * @returns {string} Encrypted string in format: iv:tag:ciphertext
   */
  static encrypt(text) {
    if (!text) return null;

    try {
      const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
      if (key.length !== KEY_LENGTH) {
        throw new Error('Invalid encryption key length');
      }

      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error('Encryption failed: ' + error.message);
    }
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedData - Encrypted string from encrypt()
   * @returns {string} Decrypted plain text
   */
  static decrypt(encryptedData) {
    if (!encryptedData) return null;

    try {
      const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
      const parts = encryptedData.split(':');

      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt an object's sensitive fields
   * @param {Object} data - Object with fields to encrypt
   * @param {string[]} fields - Array of field names to encrypt
   * @returns {Object} Object with specified fields encrypted
   */
  static encryptFields(data, fields) {
    const result = { ...data };
    for (const field of fields) {
      if (result[field]) {
        result[field] = this.encrypt(result[field]);
      }
    }
    return result;
  }

  /**
   * Decrypt an object's sensitive fields
   * @param {Object} data - Object with encrypted fields
   * @param {string[]} fields - Array of field names to decrypt
   * @returns {Object} Object with specified fields decrypted
   */
  static decryptFields(data, fields) {
    const result = { ...data };
    for (const field of fields) {
      if (result[field]) {
        result[field] = this.decrypt(result[field]);
      }
    }
    return result;
  }

  /**
   * Generate a new encryption key (run once during setup)
   * @returns {string} 32-byte hex-encoded key
   */
  static generateKey() {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
  }

  /**
   * Hash sensitive data for comparison (one-way)
   * @param {string} text - Text to hash
   * @returns {string} SHA-256 hash
   */
  static hash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}

module.exports = Encryption;
