const { getAuth } = require('firebase-admin/auth');

/**
 * registerSocketHandlers — wires the io.use() Firebase-token auth middleware
 * and the core connection/disconnection lifecycle.
 *
 * Room join handlers (join:dm, join:city) and message handlers (message:dm,
 * message:group) are added by the messaging slices (plans 02-04, 02-05).
 * This file intentionally does NOT require Message model so the server
 * boots cleanly before those slices are implemented.
 *
 * Security: T-02-01-01, T-02-01-02
 */
function registerSocketHandlers(io) {
  // Auth middleware — runs for every connection before any event handler
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Missing auth token'));
    }
    try {
      const decoded = await getAuth().verifyIdToken(token);
      // Mirror the REST requireVerified gate — defence-in-depth (T-02-01-02)
      if (!decoded.isVerified) {
        return next(new Error('User not verified'));
      }
      socket.data.uid = decoded.uid;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { uid } = socket.data;
    // Confirm authenticated handshake to the client
    socket.emit('connected', { uid });
    console.log('Authenticated socket connected:', socket.id, 'uid:', uid);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id, 'uid:', uid);
    });
  });
}

module.exports = { registerSocketHandlers };
