const Expo = require('expo-server-sdk').default;
const expo = new Expo();

/**
 * Send an Expo push notification.
 * Silently no-ops if the token is missing or invalid — the caller
 * should not fail if the user has not registered a push token yet.
 *
 * @param {string|null|undefined} expoPushToken - Expo push token stored in MongoDB
 * @param {string} title
 * @param {string} body
 * @param {object} [data={}] - extra data payload (e.g. { type: 'verification_approved' })
 */
async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken || !Expo.isExpoPushToken(expoPushToken)) return;
  await expo.sendPushNotificationsAsync([{ to: expoPushToken, title, body, data }]);
}

module.exports = { sendPushNotification };
