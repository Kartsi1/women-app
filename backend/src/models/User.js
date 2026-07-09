const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, trim: true },
  photoURL: { type: String },
  bio: { type: String, maxlength: 500 },
  homeCity: { type: String, trim: true },
  citySlug: { type: String, index: true },
  verificationStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none',
  },
  verificationDocumentUrl: { type: String },
  selfieUrl: { type: String },
  rejectionReason: { type: String },
  expoPushToken: { type: String },
  blockedUsers: [{ type: String }],
  hostsCount: { type: Number, default: 0 },
  tripsCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = model('User', userSchema);
