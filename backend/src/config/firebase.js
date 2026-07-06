const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const fs = require('fs');
const path = require('path');

const serviceAccountValue = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
let serviceAccount;

if (serviceAccountValue.startsWith('{')) {
  serviceAccount = JSON.parse(serviceAccountValue);
} else {
  const absolutePath = path.isAbsolute(serviceAccountValue) 
    ? serviceAccountValue 
    : path.resolve(process.cwd(), serviceAccountValue);
  serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

// Firebase Emulators (local dev). The Admin SDK auto-detects FIREBASE_AUTH_EMULATOR_HOST /
// FIREBASE_STORAGE_EMULATOR_HOST when set. Setting FIREBASE_USE_EMULATORS=true fills in the
// default local hosts only when they are not already provided explicitly.
if (process.env.FIREBASE_USE_EMULATORS === 'true') {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
}

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

module.exports = { getAuth, getStorage };
