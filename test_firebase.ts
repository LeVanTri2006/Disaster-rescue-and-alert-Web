import 'dotenv/config';
import { cert } from 'firebase-admin/app';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
if (!serviceAccountJson) {
  console.log('No FIREBASE_SERVICE_ACCOUNT_JSON found');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(serviceAccountJson);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  
  const credential = cert(serviceAccount);
  console.log('Successfully created credential from parsed JSON');
} catch (e) {
  console.error('Failed:', e);
}
