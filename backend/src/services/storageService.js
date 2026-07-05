const { getStorage } = require('firebase-admin/storage');

/**
 * Upload a verification document buffer to a protected Firebase Storage path.
 *
 * Path pattern: verification/<uid>/<field>
 * e.g.  verification/abc123/id-document
 *       verification/abc123/selfie
 *
 * Storage Security Rules must deny all public client reads — the only access
 * is via Admin SDK getSignedUrl (RESEARCH Pitfall 6, T-03-03).
 *
 * resumable: false is REQUIRED for small files — without it the Admin SDK
 * starts a resumable upload session which is slower and can fail for small
 * in-memory buffers (RESEARCH Pitfall / "resumable:false" note).
 *
 * @param {string} uid - Firebase UID of the uploading user
 * @param {string} field - 'id-document' | 'selfie'
 * @param {Buffer} buffer - file bytes from multer memoryStorage
 * @param {string} mimetype - MIME type (e.g. 'image/jpeg')
 */
async function uploadVerificationDoc(uid, field, buffer, mimetype) {
  const bucket = getStorage().bucket();
  await bucket.file(`verification/${uid}/${field}`).save(buffer, {
    metadata: { contentType: mimetype },
    resumable: false,
  });
}

/**
 * Generate a short-lived (15-minute) read-only signed URL for a Storage path.
 * Used by the admin panel (Plan 04) to display submitted documents without
 * making them permanently public.
 *
 * @param {string} path - Storage object path, e.g. 'verification/<uid>/id-document'
 * @returns {Promise<string>} signed URL valid for 15 minutes
 */
async function getSignedUrl(path) {
  const bucket = getStorage().bucket();
  const [url] = await bucket.file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });
  return url;
}

/**
 * Upload an arbitrary buffer to a Firebase Storage path.
 * Used for profile photos (profiles/<uid>/photo) and any future uploads
 * that don't follow the verification/<uid>/<field> path convention.
 *
 * @param {string} storagePath - Full Storage object path, e.g. 'profiles/abc123/photo'
 * @param {Buffer} buffer - file bytes from multer memoryStorage
 * @param {string} mimetype - MIME type (e.g. 'image/jpeg')
 */
async function uploadFile(storagePath, buffer, mimetype) {
  const bucket = getStorage().bucket();
  await bucket.file(storagePath).save(buffer, {
    metadata: { contentType: mimetype },
    resumable: false,
  });
}

module.exports = { uploadVerificationDoc, getSignedUrl, uploadFile };
