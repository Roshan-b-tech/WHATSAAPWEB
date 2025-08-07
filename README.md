# WhatsApp Web Clone

A production-ready WhatsApp Web clone built with React, Node.js, Socket.IO, and MongoDB. This application processes WhatsApp Business API webhooks and displays real-time conversations in a beautiful interface that closely mimics WhatsApp Web.

## Features

- 🎨 **Authentic WhatsApp Web Interface**: Pixel-perfect design with proper colors, gradients, and animations
- 💬 **Real-time Messaging**: Socket.IO powered real-time message updates
- 📱 **Fully Responsive**: Optimized for mobile, tablet, and desktop
- 🔄 **Status Indicators**: Visual indicators for sent, delivered, and read messages
- 📋 **Contact Management**: Organized contact list with unread message counts
- 🔍 **Search Functionality**: Search contacts and start new conversations
- 🗃️ **MongoDB Integration**: Persistent message storage with MongoDB Atlas
- 🔧 **Webhook Processing**: Automated processing of WhatsApp Business API webhooks
- ⚡ **Production Ready**: Built with best practices and optimized for deployment

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Socket.IO Client** for real-time communication
- **date-fns** for date formatting
- **Vite** for build tooling

### Backend
- **Node.js** with Express.js
- **Socket.IO** for WebSocket communication
- **MongoDB** with native driver
- **CORS** for cross-origin requests
- **dotenv** for environment management

## Quick Start

### 1. Clone and Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### 2. Set Up MongoDB Atlas

1. Create a free MongoDB Atlas account at https://www.mongodb.com/atlas
2. Create a new cluster
3. Create a database user and get your connection string
4. Copy `server/.env.example` to `server/.env`
5. Update the `MONGODB_URI` with your connection string

### 3. Start the Development Servers

```bash
# Terminal 1 - Start the backend server
cd server
npm run dev

# Terminal 2 - Start the frontend development server
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## Webhook Processing

### Processing Sample Payloads

The application includes a webhook processor that can handle sample WhatsApp Business API payloads:

```bash
cd server
node webhook-processor.js
```

This script will:
- Connect to your MongoDB database
- Process sample webhook payloads
- Insert messages and update statuses in the database
- Create sample contacts for demonstration

### Real Webhook Integration

To receive real WhatsApp webhooks, configure your WhatsApp Business API to send webhooks to:

```
POST https://yourdomain.com/webhook
```

The webhook processor handles:
- **New Messages**: Automatically stores incoming messages
- **Status Updates**: Updates message delivery status (sent, delivered, read)
- **Contact Information**: Maintains contact profiles and names

## Database Schema

### Collections

#### `processed_messages`
```javascript
{
  _id: "unique_message_id",
  id: "whatsapp_message_id",
  meta_msg_id: "whatsapp_message_id",
  from: "sender_wa_id",
  to: "recipient_wa_id",
  text: {
    body: "message_content"
  },
  timestamp: 1625097600000,
  type: "text",
  status: "sent|delivered|read",
  wa_id: "conversation_wa_id",
  profile_name: "Sender Name"
}
```

#### `contacts`
```javascript
{
  wa_id: "whatsapp_id",
  profile_name: "Contact Name",
  updated_at: "2023-12-01T00:00:00.000Z"
}
```

## API Endpoints

### REST API
- `GET /api/contacts` - Fetch all contacts
- `GET /api/messages/:wa_id` - Fetch messages for a specific contact
- `POST /api/messages` - Send a new message
- `POST /webhook` - Process WhatsApp webhook payloads
- `GET /health` - Health check endpoint

### WebSocket Events
- `newMessage` - Emitted when a new message is received
- `messageStatusUpdate` - Emitted when message status changes
- `join-chat` - Join a specific chat room
- `leave-chat` - Leave a specific chat room

## Deployment

### Frontend Deployment (Vercel)

1. Build the frontend:
```bash
npm run build
```

2. Deploy to Vercel:
```bash
npx vercel --prod
```

### Backend Deployment (Render/Heroku)

1. Set up environment variables on your hosting platform:
```env
MONGODB_URI=your_mongodb_connection_string
PORT=3001
NODE_ENV=production
```

2. Deploy using Git or your platform's CLI

### Full-Stack Deployment

For a complete deployment, you can use:
- **Frontend**: Vercel, Netlify, or GitHub Pages
- **Backend**: Render, Heroku, Railway, or DigitalOcean App Platform
- **Database**: MongoDB Atlas (recommended)

## Environment Variables

### Server (.env)
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp
PORT=3001
NODE_ENV=development
```

### Client (Optional)
Update the Socket.IO connection URL in `src/App.tsx` for production:
```javascript
const socket = io('https://your-backend-domain.com');
```

## Features in Detail

### Real-time Messaging
- Messages appear instantly across all connected clients
- Status updates (sent → delivered → read) are reflected in real-time
- No page refresh required for new messages or updates

### Responsive Design
- **Mobile First**: Optimized for mobile devices with touch-friendly interface
- **Tablet**: Adapted layout for medium screens
- **Desktop**: Full WhatsApp Web experience with sidebar and main chat area

### Message Status System
- **Sent** (single check): Message sent from client
- **Delivered** (double check, gray): Message delivered to WhatsApp servers
- **Read** (double check, blue): Message read by recipient

### Contact Management
- Automatic contact creation from webhook data
- Unread message counters
- Last message preview in contact list
- Search and filter functionality

## Customization

### Styling
The application uses Tailwind CSS for styling. Key design elements:
- WhatsApp green: `#25D366`
- Message bubbles: Rounded corners with proper shadows
- Responsive grid system
- Custom gradient backgrounds

### Adding New Features
1. **Message Types**: Extend the message schema for images, documents, etc.
2. **Group Chats**: Add support for group conversations
3. **Message Search**: Implement full-text search across messages
4. **File Uploads**: Add support for media attachments

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Verify your connection string
   - Check if your IP is whitelisted in MongoDB Atlas
   - Ensure the database user has proper permissions

2. **Socket.IO Connection Failed**
   - Check if the backend server is running
   - Verify CORS configuration
   - Ensure firewall allows connections on port 3001

3. **Webhook Not Receiving Data**
   - Verify the webhook URL is publicly accessible
   - Check WhatsApp Business API webhook configuration
   - Review server logs for processing errors

### Development Tips

1. **Hot Reloading**: Both frontend and backend support hot reloading during development
2. **Debugging**: Use browser DevTools Network tab to monitor WebSocket connections
3. **Database**: Use MongoDB Compass to view and manage your data
4. **Logs**: Check server console for webhook processing logs

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests if applicable
4. Commit your changes: `git commit -am 'Add new feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- WhatsApp for the inspiration and design patterns
- Meta for the WhatsApp Business API
- The React and Node.js communities for excellent tooling

---

**Note**: This is a demonstration application and should not be used for actual WhatsApp message handling without proper security measures and compliance with WhatsApp's terms of service.