const Post = require('../models/Post');
const { uploadFile, getSignedUrl } = require('../services/storageService');

const PAGE_SIZE = 20;

/**
 * POST /api/posts
 *
 * Create a new community post.
 *
 * Security (T-03-01-01): authorUid is ALWAYS taken from req.user.uid (verified token).
 *   Any authorUid in the request body is IGNORED.
 * Security (T-03-01-03): if a photo is attached, the storage PATH is stored —
 *   NOT a public URL. The signed URL is generated at read time (getFeed).
 * Security (T-03-01-04): photo size limited by multer in router (5 MB).
 * Security (T-03-01-05): text maxlength 1000 enforced by schema + non-empty trim here.
 */
async function createPost(req, res) {
  try {
    // T-03-01-01: uid ALWAYS from verified token, never from body
    const { uid } = req.user;

    const { text } = req.body;

    // Validate text
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }

    // Create post document first (to get _id for storage path)
    const post = await Post.create({ authorUid: uid, text: text.trim() });

    // Optional single photo upload
    if (req.file) {
      const storagePath = `posts/${uid}/${post._id}/photo`;
      await uploadFile(storagePath, req.file.buffer, req.file.mimetype);
      // Store the storage PATH, not a public URL (T-03-01-03)
      post.photoUrl = storagePath;
      await post.save();
    }

    return res.status(201).json({ data: { id: post._id } });
  } catch (err) {
    console.error('[createPost]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/posts
 *
 * Fetch a cursor-paginated reverse-chronological feed of posts.
 *
 * Query params:
 *   before — base64-encoded JSON { createdAt: ISO string, _id: string }
 *
 * Security (T-03-01-02): route gated by verifyFirebaseToken + requireVerified.
 * Security (T-03-01-03): photoUrl storage paths are resolved to signed URLs at read time —
 *   raw storage paths are never emitted to clients.
 */
async function getFeed(req, res) {
  try {
    let filter = {};

    if (req.query.before) {
      let cursor;
      try {
        cursor = JSON.parse(Buffer.from(req.query.before, 'base64').toString('utf8'));
      } catch {
        return res.status(400).json({ error: 'Invalid cursor' });
      }
      const cursorDate = new Date(cursor.createdAt);
      const cursorId = cursor._id;
      filter = {
        $or: [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: cursorId } },
        ],
      };
    }

    const posts = await Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(PAGE_SIZE + 1)
      .select('authorUid text photoUrl likeCount likedBy commentCount createdAt')
      .lean();

    const hasMore = posts.length > PAGE_SIZE;
    const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

    // Resolve storage paths to short-lived signed URLs (T-03-01-03)
    // Matches the listing photo discipline: never emit a raw public bucket URL
    const enriched = await Promise.all(
      page.map(async (post) => {
        if (post.photoUrl) {
          try {
            const signedUrl = await getSignedUrl(post.photoUrl);
            return { ...post, photoUrl: signedUrl };
          } catch {
            // Non-fatal — signed URL generation may fail if Firebase not configured
            return { ...post, photoUrl: null };
          }
        }
        return post;
      })
    );

    let nextCursor = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({
          createdAt: last.createdAt.toISOString(),
          _id: String(last._id),
        })
      ).toString('base64');
    }

    return res.json({ data: enriched, nextCursor, hasMore });
  } catch (err) {
    console.error('[getFeed]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createPost, getFeed };
