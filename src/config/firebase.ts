import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { FIREBASE_SERVICE_ACCOUNT_PATH } from './env';

const serviceAccountPath = path.resolve(FIREBASE_SERVICE_ACCOUNT_PATH);
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const sendPushNotification = async (
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> => {
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: data || {},
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  } catch (error) {
    console.error('Push notification failed:', (error as Error).message);
  }
};

export { admin, sendPushNotification };
