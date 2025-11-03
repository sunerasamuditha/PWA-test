// Encryption utility module using Node.js built-in crypto for AES-256-GCM authenticated encryption
const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';
const KEY = process.env.ENCRYPTION_KEY;

// Validate encryption key on module load for ALL environments
if (!KEY) {
  const errorMessage = `
╔═══════════════════════════════════════════════════════════════════════╗
║                     ENCRYPTION KEY NOT CONFIGURED                      ║
╚═══════════════════════════════════════════════════════════════════════╝

ERROR: ENCRYPTION_KEY environment variable is not set.

To generate a secure encryption key, run:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

Then add it to your .env file:
  ENCRYPTION_KEY=<generated_key>

For development, you can use a temporary key, but NEVER use the same key
in production. Generate a new key for each environment.

Current environment: ${process.env.NODE_ENV || 'development'}
`;
  
  if (process.env.NODE_ENV === 'production') {
    // In production, fail hard
    throw new Error(errorMessage);
  } else {
    // In development, warn but allow to continue
    console.warn('\x1b[33m%s\x1b[0m', errorMessage);
    console.warn('\x1b[33m%s\x1b[0m', 'WARNING: Encryption features will be disabled until ENCRYPTION_KEY is set.\n');
  }
}

if (KEY && Buffer.from(KEY, 'hex').length !== 32) {
  const errorMessage = `
ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters) for AES-256-GCM.
Current key length: ${Buffer.from(KEY, 'hex').length} bytes

Generate a valid key using:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
`;
  throw new Error(errorMessage);
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param {string} plaintext - Text to encrypt
 * @returns {object} Object with encrypted data, IV, and authentication tag
 */
function encrypt(plaintext) {
  if (!KEY) {
    throw new Error('Encryption key not configured. Set ENCRYPTION_KEY in environment variables.');
  }

  // Distinguish between undefined/null (return null) and empty string (encrypt it)
  if (plaintext === undefined || plaintext === null) {
    return null;
  }

  // Convert to string (handles numbers, etc.)
  const textToEncrypt = String(plaintext);

  // Generate random 16-byte IV (initialization vector)
  const iv = crypto.randomBytes(16);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY, 'hex'), iv);

  // Encrypt data (empty strings are valid input)
  let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag (GCM provides authentication)
  const authTag = cipher.getAuthTag();

  // Return object with all components as hex strings
  return {
    encrypted: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt encrypted data using AES-256-GCM
 * @param {object} encryptedData - Object with encrypted, iv, and authTag properties
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedData) {
  if (!KEY) {
    throw new Error('Encryption key not configured. Set ENCRYPTION_KEY in environment variables.');
  }

  if (!encryptedData || !encryptedData.encrypted || !encryptedData.iv || !encryptedData.authTag) {
    return null;
  }

  try {
    // Convert hex strings back to buffers
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const encrypted = encryptedData.encrypted;

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY, 'hex'), iv);

    // Set authentication tag
    decipher.setAuthTag(authTag);

    // Decrypt data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Decryption failed - wrong key, tampered data, or corrupt data
    throw new Error('Decryption failed: ' + error.message);
  }
}

/**
 * Encrypt a JSON object
 * @param {object} jsonObject - Object to encrypt
 * @returns {object} Encrypted data object
 */
function encryptJSON(jsonObject) {
  if (!jsonObject) {
    return null;
  }

  const jsonString = JSON.stringify(jsonObject);
  return encrypt(jsonString);
}

/**
 * Decrypt and parse a JSON object
 * @param {object} encryptedObject - Encrypted data object
 * @returns {object} Decrypted and parsed JSON object
 */
function decryptJSON(encryptedObject) {
  if (!encryptedObject) {
    return null;
  }

  const jsonString = decrypt(encryptedObject);
  return jsonString ? JSON.parse(jsonString) : null;
}

/**
 * Check if a value is already encrypted
 * @param {any} value - Value to check
 * @returns {boolean} True if value has encrypted structure
 */
function isEncrypted(value) {
  return (
    value &&
    typeof value === 'object' &&
    value.encrypted &&
    value.iv &&
    value.authTag
  );
}

/**
 * Encrypt a field value if not already encrypted
 * @param {any} value - Value to encrypt
 * @returns {object|null} Encrypted object or null if value is null/undefined
 */
function encryptField(value) {
  // null and undefined map to null (field intentionally cleared)
  if (value === null || value === undefined) {
    return null;
  }

  // If already encrypted, return as-is
  if (isEncrypted(value)) {
    return value;
  }

  // Encrypt value (including empty strings)
  return encrypt(String(value));
}

/**
 * Decrypt a field value if encrypted
 * @param {any} value - Value to decrypt
 * @returns {string|any} Decrypted string or original value if not encrypted
 */
function decryptField(value) {
  if (!value) {
    return null;
  }

  // If encrypted, decrypt it
  if (isEncrypted(value)) {
    return decrypt(value);
  }

  // Return as-is if not encrypted (backward compatibility)
  return value;
}

module.exports = {
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  encryptField,
  decryptField,
  isEncrypted
};
