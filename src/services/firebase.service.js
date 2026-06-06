'use strict';

const admin = require('firebase-admin');
const logger = require('../utils/logger');

let initialized = false;

function initialize() {
  if (initialized) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn('Firebase env vars not set — push notifications disabled');
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      // Render stores the key as a single line with literal \n — replace them
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
  initialized = true;
  logger.info('Firebase Admin SDK initialized');
}

async function sendPush(token, title, body, data = {}) {
  if (!initialized) {
    logger.warn('Firebase not initialized, skipping push', { token });
    return null;
  }

  const message = {
    token,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
  };

  try {
    const result = await admin.messaging().send(message);
    return result;
  } catch (err) {
    // Token invalid / unregistered — caller can handle cleanup
    logger.warn('FCM send failed', { token, error: err.message });
    throw err;
  }
}

module.exports = { initialize, sendPush };
