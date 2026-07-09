require('dotenv').config();
require('./config/firebase');
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const adminRouter = require('./routes/admin');
const listingsRouter = require('./routes/listings');
const requestsRouter = require('./routes/requests');
const messageRequestsRouter = require('./routes/messageRequests');
const conversationsRouter = require('./routes/conversations');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    // T-02-01-03: scope CORS to explicit origins instead of '*'
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/message-requests', messageRequestsRouter);
app.use('/api/conversations', conversationsRouter);
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const { registerSocketHandlers } = require('./socket/chatHandler');
registerSocketHandlers(io);

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  await connectDB();
  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

bootstrap();
