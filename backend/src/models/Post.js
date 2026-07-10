const { Schema, model } = require('mongoose');

const postSchema = new Schema(
  {
    authorUid:    { type: String, required: true, index: true },
    text:         { type: String, required: true, maxlength: 1000 },
    photoUrl:     { type: String, default: null }, // stores Firebase Storage PATH, not a URL
    likedBy:      [{ type: String }],              // array of Firebase UIDs
    likeCount:    { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound cursor index for reverse-chronological feed pagination
postSchema.index({ createdAt: -1, _id: -1 });
postSchema.index({ authorUid: 1 });

module.exports = model('Post', postSchema);
