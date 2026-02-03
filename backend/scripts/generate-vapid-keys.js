const webpush = require('web-push');

console.log('Generating VAPID keys for web push notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID Keys Generated Successfully!\n');
console.log('Add these to your .env file:\n');
console.log('WEB_PUSH_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('WEB_PUSH_PRIVATE_KEY=' + vapidKeys.privateKey);
console.log('WEB_PUSH_EMAIL=mailto:your-email@example.com');
console.log('\nIMPORTANT: Keep the private key secret and never commit it to version control!');
