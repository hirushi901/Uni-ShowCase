const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// JWTs authenticate users and authorize every protected API route.  Never use
// a source-controlled fallback: a missing secret must stop the service rather
// than make token signing predictable.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
  throw new Error('JWT_SECRET must be configured and contain at least 32 characters');
}

const connectDB = require('./config/db');
const User = require('./models/User');
const initEventListeners = require('./events/listeners');
const { initSocketManager, registerSocket, removeSocket } = require('./socket/socketManager');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const server = http.createServer(app);

connectDB();
initEventListeners();

// ── CORS ─────────────────────────────────────────────────────────────────────
let frontendUrl = process.env.FRONTEND_URL || '';
if (frontendUrl.endsWith('/')) {
  frontendUrl = frontendUrl.slice(0, -1);
}

const allowedOrigins = [
  frontendUrl,
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Dynamically allow Vercel previews and deployment domains
  if (origin.endsWith('.vercel.app')) return true;
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true
}));

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS for sockets'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

initSocketManager(io);

// Authenticate the socket before it is connected. Its identity comes from the
// verified JWT, not from a client-controlled event payload.
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('_id');
    if (!user) return next(new Error('Authentication failed'));

    socket.userId = user._id.toString();
    return next();
  } catch (error) {
    return next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  registerSocket(userId, socket.id);
  console.log(`[Socket] Authenticated user ${userId} connected → socket ${socket.id}`);

  socket.on('disconnect', () => {
    if (socket.userId) {
      removeSocket(socket.userId, socket.id);
    }
    console.log(`[Socket] Socket ${socket.id} disconnected`);
  });
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Net-Centric Application Backend Services API',
    timestamp: new Date()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', interactionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
