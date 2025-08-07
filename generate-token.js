import crypto from 'crypto';

// Generate a secure webhook verify token
function generateWebhookToken() {
    // Generate 32 random bytes and convert to hex string
    const token = crypto.randomBytes(32).toString('hex');
    return token;
}

// Generate multiple tokens for you to choose from
console.log('🔐 Secure Webhook Verify Tokens:');
console.log('================================');
for (let i = 1; i <= 5; i++) {
    const token = generateWebhookToken();
    console.log(`${i}. ${token}`);
}

console.log('\n📝 Instructions:');
console.log('1. Copy one of the tokens above');
console.log('2. Paste it in your .env file as WEBHOOK_VERIFY_TOKEN');
console.log('3. Use the same token in your Meta for Developers webhook configuration');
console.log('\n⚠️  Keep this token secret and secure!');
