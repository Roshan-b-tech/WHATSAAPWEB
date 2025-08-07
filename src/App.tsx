import React, { useState, useEffect } from 'react';
import { Search, MoreVertical, Paperclip, Smile, Send, Check, CheckCheck } from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import io from 'socket.io-client';
import axios from 'axios';

interface Message {
  _id: string;
  id: string;
  from: string;
  to: string;
  text?: {
    body: string;
  };
  timestamp: number;
  type: string;
  status?: 'sent' | 'delivered' | 'read';
  wa_id: string;
  profile_name?: string;
}

interface Contact {
  wa_id: string;
  profile_name: string;
  lastMessage?: Message;
  unreadCount: number;
}

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling']
});

function App() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Socket connection
    socket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    socket.on('newMessage', (message: Message) => {
      setMessages(prev => [...prev, message]);
      updateContactLastMessage(message);
    });

    socket.on('messageStatusUpdate', (update: { messageId: string; status: string }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg._id === update.messageId
            ? { ...msg, status: update.status as 'sent' | 'delivered' | 'read' }
            : msg
        )
      );
    });

    // Load initial data
    loadContacts();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('newMessage');
      socket.off('messageStatusUpdate');
    };
  }, []);

  const loadContacts = async () => {
    try {
      // Load contacts from production API
      const response = await axios.get('https://whatsaapweb.onrender.com/api/contacts');
      const apiContacts = response.data;

      // Transform API data to match our interface
      const contacts: Contact[] = apiContacts.map((contact: any) => ({
        wa_id: contact.wa_id,
        profile_name: contact.profile_name,
        unreadCount: contact.unreadCount || 0,
        lastMessage: contact.lastMessage
      }));

      setContacts(contacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      // Fallback to mock data if API fails
      const mockContacts: Contact[] = [
        {
          wa_id: '1234567890',
          profile_name: 'John Doe',
          unreadCount: 2,
          lastMessage: {
            _id: '1',
            id: 'msg1',
            from: '1234567890',
            to: 'me',
            text: { body: 'Hey there! How are you?' },
            timestamp: Date.now() - 3600000,
            type: 'text',
            status: 'read',
            wa_id: '1234567890',
            profile_name: 'John Doe'
          }
        },
        {
          wa_id: '0987654321',
          profile_name: 'Jane Smith',
          unreadCount: 0,
          lastMessage: {
            _id: '2',
            id: 'msg2',
            from: 'me',
            to: '0987654321',
            text: { body: 'Thanks for the help!' },
            timestamp: Date.now() - 7200000,
            type: 'text',
            status: 'delivered',
            wa_id: '0987654321',
            profile_name: 'Jane Smith'
          }
        },
        {
          wa_id: '5555555555',
          profile_name: 'Mike Johnson',
          unreadCount: 1,
          lastMessage: {
            _id: '3',
            id: 'msg3',
            from: '5555555555',
            to: 'me',
            text: { body: 'Can we meet tomorrow?' },
            timestamp: Date.now() - 1800000,
            type: 'text',
            status: 'sent',
            wa_id: '5555555555',
            profile_name: 'Mike Johnson'
          }
        }
      ];
      setContacts(mockContacts);
    }
  };

  const loadMessages = async (wa_id: string) => {
    try {
      // Load messages from production API
      const response = await axios.get(`https://whatsaapweb.onrender.com/api/messages/${wa_id}`);
      const apiMessages = response.data;

      // Transform API data to match our interface
      const messages: Message[] = apiMessages.map((msg: any) => ({
        _id: msg._id,
        id: msg.id,
        from: msg.from,
        to: msg.to,
        text: msg.text,
        timestamp: msg.timestamp,
        type: msg.type,
        status: msg.status,
        wa_id: msg.wa_id,
        profile_name: msg.profile_name
      }));

      setMessages(messages);
    } catch (error) {
      console.error('Error loading messages:', error);
      // Fallback to mock data if API fails
      const mockMessages: Message[] = [
        {
          _id: '1',
          id: 'msg1',
          from: wa_id,
          to: 'me',
          text: { body: 'Hey there! How are you?' },
          timestamp: Date.now() - 3600000,
          type: 'text',
          status: 'read',
          wa_id: wa_id,
          profile_name: contacts.find(c => c.wa_id === wa_id)?.profile_name || ''
        },
        {
          _id: '2',
          id: 'msg2',
          from: 'me',
          to: wa_id,
          text: { body: 'I\'m doing great! Thanks for asking.' },
          timestamp: Date.now() - 3500000,
          type: 'text',
          status: 'read',
          wa_id: wa_id
        },
        {
          _id: '3',
          id: 'msg3',
          from: wa_id,
          to: 'me',
          text: { body: 'That\'s wonderful to hear!' },
          timestamp: Date.now() - 3000000,
          type: 'text',
          status: 'delivered',
          wa_id: wa_id,
          profile_name: contacts.find(c => c.wa_id === wa_id)?.profile_name || ''
        }
      ];
      setMessages(mockMessages);
    }
  };

  const updateContactLastMessage = (message: Message) => {
    setContacts(prev =>
      prev.map(contact =>
        contact.wa_id === message.wa_id
          ? { ...contact, lastMessage: message, unreadCount: message.from !== 'me' ? contact.unreadCount + 1 : contact.unreadCount }
          : contact
      )
    );
  };

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    loadMessages(contact.wa_id);
    // Mark as read
    setContacts(prev =>
      prev.map(c =>
        c.wa_id === contact.wa_id
          ? { ...c, unreadCount: 0 }
          : c
      )
    );
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact) return;

    const message: Message = {
      _id: Date.now().toString(),
      id: `msg_${Date.now()}`,
      from: 'me',
      to: selectedContact.wa_id,
      text: { body: newMessage.trim() },
      timestamp: Date.now(),
      type: 'text',
      status: 'sent',
      wa_id: selectedContact.wa_id
    };

    setMessages(prev => [...prev, message]);
    updateContactLastMessage(message);
    setNewMessage('');

    // Send message to production API
    try {
      await axios.post('https://whatsaapweb.onrender.com/api/messages', {
        wa_id: selectedContact.wa_id,
        text: { body: newMessage.trim() },
        from: 'me',
        to: selectedContact.wa_id,
        type: 'text'
      });
    } catch (error) {
      console.error('Error sending message to API:', error);
    }

    // Simulate status updates
    setTimeout(() => {
      setMessages(prev =>
        prev.map(msg =>
          msg._id === message._id
            ? { ...msg, status: 'delivered' }
            : msg
        )
      );
    }, 1000);

    setTimeout(() => {
      setMessages(prev =>
        prev.map(msg =>
          msg._id === message._id
            ? { ...msg, status: 'read' }
            : msg
        )
      );
    }, 3000);
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'dd/MM/yyyy');
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sent':
        return <Check className="w-4 h-4 text-gray-500" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-gray-500" />;
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.profile_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.wa_id.includes(searchQuery)
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="flex flex-col w-full md:w-1/3 lg:w-1/4 bg-white border-r border-gray-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
              W
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">WhatsApp Web</span>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          </div>
          <MoreVertical className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-none focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.map((contact) => (
            <div
              key={contact.wa_id}
              onClick={() => handleContactClick(contact)}
              className={`flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${selectedContact?.wa_id === contact.wa_id ? 'bg-green-50 border-l-4 border-l-green-500' : ''
                }`}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold mr-3">
                {contact.profile_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {contact.profile_name}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {contact.lastMessage && formatMessageTime(contact.lastMessage.timestamp)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 truncate">
                    {contact.lastMessage?.from === 'me' && (
                      <span className="inline-flex mr-1">
                        {getStatusIcon(contact.lastMessage.status)}
                      </span>
                    )}
                    {contact.lastMessage?.text?.body || 'No messages yet'}
                  </p>
                  {contact.unreadCount > 0 && (
                    <span className="bg-green-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                      {contact.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center p-4 bg-gray-50 border-b border-gray-200">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold mr-3">
                {selectedContact.profile_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedContact.profile_name}
                </h2>
                <p className="text-sm text-gray-500">+{selectedContact.wa_id}</p>
              </div>
              <div className="flex items-center space-x-2">
                <Search className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
                <MoreVertical className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50" style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cdefs%3E%3Cpattern id="chat-bg" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse"%3E%3Cpath d="M0 100V.5h100" fill="none" stroke="%23f3f4f6" stroke-width=".5"/%3E%3C/pattern%3E%3C/defs%3E%3Crect width="100" height="100" fill="url(%23chat-bg)"/%3E%3C/svg%3E")'
            }}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message._id}
                    className={`flex ${message.from === 'me' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-sm ${message.from === 'me'
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-900'
                        }`}
                    >
                      <p className="text-sm">{message.text?.body}</p>
                      <div className={`flex items-center justify-end space-x-1 mt-1 ${message.from === 'me' ? 'text-green-100' : 'text-gray-500'
                        }`}>
                        <span className="text-xs">
                          {formatMessageTime(message.timestamp)}
                        </span>
                        {message.from === 'me' && getStatusIcon(message.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <Paperclip className="w-6 h-6 text-gray-500 cursor-pointer hover:text-gray-700" />
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message"
                    className="w-full px-4 py-3 pr-12 bg-white rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <Smile className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-500 cursor-pointer hover:text-gray-700" />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-64 h-64 mx-auto mb-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center">
                  <div className="text-6xl font-bold text-green-500">W</div>
                </div>
              </div>
              <h1 className="text-3xl font-light text-gray-700 mb-4">WhatsApp Web</h1>
              <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                Send and receive messages without keeping your phone online. Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
              </p>
              <div className="mt-8 text-sm text-gray-400">
                Select a chat to start messaging
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;