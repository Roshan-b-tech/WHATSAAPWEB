import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
let db;
const connectToDatabase = async () => {
  try {
    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
    await client.connect();
    db = client.db('whatsapp');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Use in-memory storage as fallback
    db = null;
  }
};

// In-memory storage for demo purposes (when MongoDB is not available)
let messagesStore = [];
let contactsStore = [
  {
    wa_id: '1234567890',
    profile_name: 'John Doe',
    unreadCount: 2
  },
  {
    wa_id: '0987654321',
    profile_name: 'Jane Smith',
    unreadCount: 0
  },
  {
    wa_id: '5555555555',
    profile_name: 'Mike Johnson',
    unreadCount: 1
  }
];

// API Routes
app.get('/api/contacts', async (req, res) => {
  try {
    if (db) {
      const contacts = await db.collection('contacts').find({}).toArray();
      res.json(contacts);
    } else {
      res.json(contactsStore);
    }
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

app.get('/api/messages/:wa_id', async (req, res) => {
  try {
    const { wa_id } = req.params;

    if (db) {
      const messages = await db.collection('processed_messages')
        .find({ wa_id })
        .sort({ timestamp: 1 })
        .toArray();
      res.json(messages);
    } else {
      const messages = messagesStore.filter(msg => msg.wa_id === wa_id);
      res.json(messages);
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const message = {
      ...req.body,
      timestamp: Date.now(),
      _id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    if (db) {
      await db.collection('processed_messages').insertOne(message);
    } else {
      messagesStore.push(message);
    }

    // Emit to all connected clients
    io.emit('newMessage', message);

    res.status(201).json(message);
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('Webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

// Webhook endpoint for processing WhatsApp payloads
app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Received webhook payload:', JSON.stringify(payload, null, 2));

    // Process different types of payloads
    if (payload.entry && payload.entry[0] && payload.entry[0].changes) {
      const changes = payload.entry[0].changes[0];

      if (changes.field === 'messages' && changes.value) {
        const { messages, statuses, contacts } = changes.value;

        // Process new messages
        if (messages) {
          for (const message of messages) {
            const processedMessage = {
              _id: `msg_${message.id}`,
              id: message.id,
              from: message.from,
              to: changes.value.metadata?.phone_number_id || 'business',
              text: message.text,
              timestamp: parseInt(message.timestamp) * 1000,
              type: message.type,
              status: 'received',
              wa_id: message.from,
              profile_name: contacts?.[0]?.profile?.name || message.from
            };

            if (db) {
              await db.collection('processed_messages').insertOne(processedMessage);
            } else {
              messagesStore.push(processedMessage);
            }

            // Emit to all connected clients
            io.emit('newMessage', processedMessage);
          }
        }

        // Process status updates
        if (statuses) {
          for (const status of statuses) {
            const updateQuery = {
              $or: [
                { id: status.id },
                { meta_msg_id: status.id }
              ]
            };

            if (db) {
              await db.collection('processed_messages').updateOne(
                updateQuery,
                { $set: { status: status.status } }
              );
            } else {
              const messageIndex = messagesStore.findIndex(msg =>
                msg.id === status.id || msg.meta_msg_id === status.id
              );
              if (messageIndex !== -1) {
                messagesStore[messageIndex].status = status.status;
              }
            }

            // Emit status update to all connected clients
            io.emit('messageStatusUpdate', {
              messageId: status.id,
              status: status.status
            });
          }
        }

        // Process contacts
        if (contacts) {
          for (const contact of contacts) {
            if (db) {
              await db.collection('contacts').updateOne(
                { wa_id: contact.wa_id },
                {
                  $set: {
                    profile_name: contact.profile?.name || contact.wa_id,
                    wa_id: contact.wa_id
                  }
                },
                { upsert: true }
              );
            } else {
              const existingContact = contactsStore.find(c => c.wa_id === contact.wa_id);
              if (!existingContact) {
                contactsStore.push({
                  wa_id: contact.wa_id,
                  profile_name: contact.profile?.name || contact.wa_id,
                  unreadCount: 0
                });
              }
            }
          }
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  socket.on('join-chat', (wa_id) => {
    socket.join(`chat-${wa_id}`);
    console.log(`User ${socket.id} joined chat ${wa_id}`);
  });

  socket.on('leave-chat', (wa_id) => {
    socket.leave(`chat-${wa_id}`);
    console.log(`User ${socket.id} left chat ${wa_id}`);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'in-memory'
  });
});

const PORT = process.env.PORT || 3001;

// Initialize server
const startServer = async () => {
  await connectToDatabase();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
  });
};

startServer();