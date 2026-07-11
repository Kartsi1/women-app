const Comment = require('../models/Comment');
const Post = require('../models/Post');
const User = require('../models/User');
const { sendPushNotification } = require('../services/notificationService');

/**
 * POST /api/posts/:id/comments
 *
 * Create a comment on a post and optionally notify the post author.
 *
 * Security (T-03-02-02): authorUid is ALWAYS taken from req.user.uid (verified token).
 *   Any authorUid in the request body is IGNORED.
 * Security (T-03-02-06): text maxlength 500 enforced by schema + non-empty trim validation.
 * Push notification: fire-and-forget — any error is swallowed so the comment still saves.
 *   Push is skipped when the commenter IS the post author (no self-notification).
 */
async function createComment(req, res) {
  try {
    // T-03-02-02: uid ALWAYS from verified token, never from body
    const { uid } = req.user;
    const postId = req.params.id;

    const { text } = req.body;

    // Validate text non-empty (T-03-02-06)
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }

    const trimmed = text.trim();

    // Load post to get authorUid and verify it exists
    const post = await Post.findById(postId).select('authorUid commentCount').lean();
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Create comment — authorUid from token, never from body
    const comment = await Comment.create({ postId, authorUid: uid, text: trimmed });

    // Increment commentCount on post
    await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

    // Fire-and-forget push notification to post author (skip when commenter === author)
    if (post.authorUid !== uid) {
      // Look up author's push token — swallow all errors
      try {
        const author = await User.findOne({ firebaseUid: post.authorUid })
          .select('expoPushToken')
          .lean();
        await sendPushNotification(
          author?.expoPushToken,
          'New comment on your post',
          trimmed.substring(0, 80),
          { type: 'post_comment', postId: String(postId) }
        );
      } catch (pushErr) {
        // Non-fatal — push failure must not fail the comment request
        console.error('[createComment] push notification failed (non-fatal):', pushErr);
      }
    }

    return res.status(201).json({ data: { id: comment._id } });
  } catch (err) {
    console.error('[createComment]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/posts/:id/comments
 *
 * Return all comments for a post in chronological order (oldest first).
 */
async function getComments(req, res) {
  try {
    const comments = await Comment.find({ postId: req.params.id })
      .sort({ createdAt: 1 })
      .select('authorUid text createdAt')
      .lean();

    // Read-time author join so profile renames reflect on existing comments.
    const uids = [...new Set(comments.map((c) => c.authorUid))];
    const authors = await User.find({ firebaseUid: { $in: uids } })
      .select('firebaseUid displayName')
      .lean();
    const nameMap = Object.fromEntries(
      authors.map((a) => [a.firebaseUid, a.displayName || 'Member'])
    );
    const withNames = comments.map((c) => ({
      ...c,
      authorName: nameMap[c.authorUid] || 'Member',
    }));

    return res.json({ data: withNames });
  } catch (err) {
    console.error('[getComments]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createComment, getComments };
