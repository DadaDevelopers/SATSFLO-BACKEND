const crypto = require('crypto');

console.log('\n SATSFLOW BACKEND - Security Keys Generator\n');
console.log('=' .repeat(60));

// Generate JWT Secret (for access tokens)
const jwtSecret = crypto.randomBytes(32).toString('hex');
console.log('\n📝 JWT_SECRET (for access tokens):');
console.log(jwtSecret);

// Generate JWT Refresh Secret (for refresh tokens)
const jwtRefreshSecret = crypto.randomBytes(32).toString('hex');
console.log('\n📝 JWT_REFRESH_SECRET (for refresh tokens):');
console.log(jwtRefreshSecret);

// Generate Encryption Key (for health data)
const encryptionKey = crypto.randomBytes(32).toString('hex');
console.log('\n🔒 ENCRYPTION_KEY (for health data):');
console.log(encryptionKey);

console.log('\n' + '='.repeat(60));
console.log('\n✅ Copy these to your .env file');
console.log('⚠️  NEVER commit these keys to git!');
console.log('⚠️  Generate NEW keys for production!\n');
