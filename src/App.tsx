import React, { useState, useEffect, useRef } from 'react';
import { Search, MoreVertical, Paperclip, Smile, Send, Check, CheckCheck, Image, Video, FileText, Mic, Phone, Video as VideoCall } from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import io from 'socket.io-client';
import axios from 'axios';
import EmojiPicker from 'emoji-picker-react';

interface Message {
  _id: string;
  id: string;
  from: string;
  to: string;
  text?: {
    body: string;
  };
  image?: {
    url: string;
    caption?: string;
  };
  video?: {
    url: string;
    caption?: string;
  };
  document?: {
    url: string;
    filename: string;
    mimetype: string;
  };
  audio?: {
    url: string;
    duration: number;
  };
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'document' | 'audio';
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedContactsForGroup, setSelectedContactsForGroup] = useState<string[]>([]);
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    privacy: false,
    storage: false,
    help: false
  });
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const contactMenuRef = useRef<HTMLDivElement>(null);

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

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (showAttachmentMenu && !(event.target as Element)?.closest('.attachment-menu')) {
        setShowAttachmentMenu(false);
      }
      if (chatMenuRef.current && !chatMenuRef.current.contains(event.target as Node)) {
        setShowChatMenu(false);
      }
      if (contactMenuRef.current && !contactMenuRef.current.contains(event.target as Node)) {
        setShowContactMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttachmentMenu, showChatMenu, showContactMenu]);

  // Close modals when clicking outside
  useEffect(() => {
    const handleModalClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showSettings && target.classList.contains('fixed')) {
        setShowSettings(false);
      }
      if (showNewGroup && target.classList.contains('fixed')) {
        setShowNewGroup(false);
        setGroupName('');
        setSelectedContactsForGroup([]);
      }
      if (showPrivacy && target.classList.contains('fixed')) {
        setShowPrivacy(false);
      }
      if (showStorage && target.classList.contains('fixed')) {
        setShowStorage(false);
      }
      if (showHelp && target.classList.contains('fixed')) {
        setShowHelp(false);
      }
    };

    document.addEventListener('mousedown', handleModalClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleModalClickOutside);
    };
  }, [showSettings, showNewGroup, showPrivacy, showStorage, showHelp]);

  const loadContacts = async () => {
    try {
      // Load contacts from production API
      const response = await axios.get('https://whatsaapweb.onrender.com/api/contacts');
      const apiContacts = response.data;

      // Load last message for each contact
      const contactsWithMessages: Contact[] = await Promise.all(
        apiContacts.map(async (contact: any) => {
          try {
            // Get messages for this contact
            const messagesResponse = await axios.get(`https://whatsaapweb.onrender.com/api/messages/${contact.wa_id}`);
            const messages = messagesResponse.data;

            // Get the last message
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

            return {
              wa_id: contact.wa_id,
              profile_name: contact.profile_name,
              unreadCount: contact.unreadCount || 0,
              lastMessage: lastMessage ? {
                _id: lastMessage._id,
                id: lastMessage.id,
                from: lastMessage.from,
                to: lastMessage.to,
                text: lastMessage.text,
                timestamp: lastMessage.timestamp,
                type: lastMessage.type,
                status: lastMessage.status,
                wa_id: lastMessage.wa_id,
                profile_name: lastMessage.profile_name
              } : undefined
            };
          } catch (error) {
            console.error(`Error loading messages for ${contact.wa_id}:`, error);
            return {
              wa_id: contact.wa_id,
              profile_name: contact.profile_name,
              unreadCount: contact.unreadCount || 0,
              lastMessage: undefined
            };
          }
        })
      );

      setContacts(contactsWithMessages);
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
    setShowEmojiPicker(false);

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

  const handleEmojiClick = (emojiObject: any) => {
    setNewMessage(prev => prev + emojiObject.emoji);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedContact) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const fileUrl = e.target?.result as string;
      let messageType: 'image' | 'video' | 'document' = 'document';
      let messageData: any = {};

      if (file.type.startsWith('image/')) {
        messageType = 'image';
        messageData = {
          image: {
            url: fileUrl,
            caption: file.name
          }
        };
      } else if (file.type.startsWith('video/')) {
        messageType = 'video';
        messageData = {
          video: {
            url: fileUrl,
            caption: file.name
          }
        };
      } else {
        messageData = {
          document: {
            url: fileUrl,
            filename: file.name,
            mimetype: file.type
          }
        };
      }

      const message: Message = {
        _id: Date.now().toString(),
        id: `msg_${Date.now()}`,
        from: 'me',
        to: selectedContact.wa_id,
        ...messageData,
        timestamp: Date.now(),
        type: messageType,
        status: 'sent',
        wa_id: selectedContact.wa_id
      };

      setMessages(prev => [...prev, message]);
      updateContactLastMessage(message);
      setShowAttachmentMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const handleVoiceMessage = () => {
    if (!selectedContact) return;

    setIsRecording(!isRecording);
    if (!isRecording) {
      // Simulate recording
      setTimeout(() => {
        const message: Message = {
          _id: Date.now().toString(),
          id: `msg_${Date.now()}`,
          from: 'me',
          to: selectedContact.wa_id,
          audio: {
            url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT',
            duration: 3
          },
          timestamp: Date.now(),
          type: 'audio',
          status: 'sent',
          wa_id: selectedContact.wa_id
        };
        setMessages(prev => [...prev, message]);
        updateContactLastMessage(message);
        setIsRecording(false);
      }, 3000);
    }
  };

  const handleSearchClick = () => {
    setSearchMode(!searchMode);
    if (!searchMode) {
      setSearchQuery('');
    }
  };

  const handleContactMenuClick = () => {
    setShowContactMenu(!showContactMenu);
    setShowChatMenu(false);
  };

  const handleChatMenuClick = () => {
    setShowChatMenu(!showChatMenu);
    setShowContactMenu(false);
  };

  const handleClearChat = () => {
    if (selectedContact) {
      setMessages([]);
      setShowChatMenu(false);
    }
  };

  const handleDeleteChat = () => {
    if (selectedContact) {
      setSelectedContact(null);
      setMessages([]);
      setShowChatMenu(false);
    }
  };

  const handleBlockContact = () => {
    if (selectedContact) {
      // Simulate blocking
      alert(`${selectedContact.profile_name} has been blocked`);
      setShowChatMenu(false);
    }
  };

  const handleReportContact = () => {
    if (selectedContact) {
      // Simulate reporting
      alert(`Report submitted for ${selectedContact.profile_name}`);
      setShowChatMenu(false);
    }
  };

  // Contact menu functions
  const handleNewGroup = () => {
    setShowNewGroup(true);
    setShowContactMenu(false);
  };

  const handleNewBroadcast = () => {
    alert('New broadcast feature coming soon!');
    setShowContactMenu(false);
  };

  const handleWhatsAppWeb = () => {
    alert('WhatsApp Web info: This is a clone built with React and Node.js');
    setShowContactMenu(false);
  };

  const handleStarredMessages = () => {
    alert('Starred messages feature coming soon!');
    setShowContactMenu(false);
  };

  const handleSettings = () => {
    setShowSettings(true);
    setShowContactMenu(false);
  };

  const handleCreateGroup = () => {
    if (groupName.trim() && selectedContactsForGroup.length > 0) {
      alert(`Group "${groupName}" created with ${selectedContactsForGroup.length} members!`);
      setShowNewGroup(false);
      setGroupName('');
      setSelectedContactsForGroup([]);
    } else {
      alert('Please enter a group name and select at least one contact.');
    }
  };

  const handleToggleContactForGroup = (contactId: string) => {
    setSelectedContactsForGroup(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  // Settings functions
  const handleToggleNotifications = () => {
    setSettings(prev => ({ ...prev, notifications: !prev.notifications }));
  };

  const handleToggleDarkMode = () => {
    setSettings(prev => ({ ...prev, darkMode: !prev.darkMode }));
    // Apply dark mode to body
    if (settings.darkMode) {
      document.body.classList.remove('dark');
    } else {
      document.body.classList.add('dark');
    }
  };

  const handlePrivacyClick = () => {
    setShowPrivacy(true);
    setShowSettings(false);
  };

  const handleStorageClick = () => {
    setShowStorage(true);
    setShowSettings(false);
  };

  const handleHelpClick = () => {
    setShowHelp(true);
    setShowSettings(false);
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

  const renderMessageContent = (message: Message) => {
    switch (message.type) {
      case 'image':
        return (
          <div className="max-w-xs">
            <img
              src={message.image?.url}
              alt={message.image?.caption || 'Image'}
              className="rounded-lg max-w-full"
            />
            {message.image?.caption && (
              <p className="text-sm mt-1">{message.image.caption}</p>
            )}
          </div>
        );
      case 'video':
        return (
          <div className="max-w-xs">
            <video
              src={message.video?.url}
              controls
              className="rounded-lg max-w-full"
            />
            {message.video?.caption && (
              <p className="text-sm mt-1">{message.video.caption}</p>
            )}
          </div>
        );
      case 'document':
        return (
          <div className={`flex items-center space-x-2 p-2 rounded-lg ${settings.darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <FileText className="w-6 h-6 text-blue-500" />
            <div>
              <p className={`text-sm font-medium ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>{message.document?.filename}</p>
              <p className={`text-xs ${settings.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{message.document?.mimetype}</p>
            </div>
          </div>
        );
      case 'audio':
        return (
          <div className={`flex items-center space-x-2 p-2 rounded-lg ${settings.darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
            <audio src={message.audio?.url} controls className="h-8" />
            <span className={`text-xs ${settings.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{message.audio?.duration}s</span>
          </div>
        );
      default:
        return (
          <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-sm ${message.from === 'me'
            ? 'bg-green-500 text-white'
            : settings.darkMode
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-900'
            }`}>
            {message.text?.body}
          </div>
        );
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.profile_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.wa_id.includes(searchQuery)
  );

  const filteredMessages = searchMode && searchQuery
    ? messages.filter(message =>
      message.text?.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.image?.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.video?.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.document?.filename?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : messages;

  return (
    <div className={`flex h-screen ${settings.darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {/* Sidebar */}
      <div className={`flex flex-col ${settings.darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border-r transition-all duration-300 ${selectedContact ? 'hidden md:flex w-full md:w-1/3 lg:w-1/4' : 'w-full md:w-1/3 lg:w-1/4'
        }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 ${settings.darkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'} border-b`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
              W
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-medium ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>WhatsApp Web</span>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          </div>
          <div className="relative">
            <MoreVertical
              className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700"
              onClick={handleContactMenuClick}
            />
            {showContactMenu && (
              <div
                ref={contactMenuRef}
                className={`absolute right-0 top-8 rounded-lg shadow-lg border p-2 z-10 min-w-[150px] ${settings.darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}
              >
                <button
                  onClick={handleNewGroup}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${settings.darkMode ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
                >
                  New group
                </button>
                <button
                  onClick={handleNewBroadcast}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${settings.darkMode ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
                >
                  New broadcast
                </button>
                <button
                  onClick={handleWhatsAppWeb}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${settings.darkMode ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
                >
                  WhatsApp Web
                </button>
                <button
                  onClick={handleStarredMessages}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${settings.darkMode ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
                >
                  Starred messages
                </button>
                <button
                  onClick={handleSettings}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${settings.darkMode ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
                >
                  Settings
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className={`p-2 sm:p-3 border-b ${settings.darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 cursor-pointer hover:text-gray-600"
              onClick={handleSearchClick}
            />
            <input
              type="text"
              placeholder={searchMode ? "Search in chat" : "Search or start new chat"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 sm:pl-10 pr-4 py-2 rounded-lg border-none focus:outline-none focus:ring-2 focus:ring-green-500 text-sm sm:text-base ${settings.darkMode ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-100 text-gray-900 placeholder-gray-500'}`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Contacts List */}
        <div className={`flex-1 overflow-y-auto ${settings.darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          {filteredContacts.map((contact) => (
            <div
              key={contact.wa_id}
              onClick={() => handleContactClick(contact)}
              className={`flex items-center p-3 sm:p-4 cursor-pointer border-b transition-colors duration-200 ${settings.darkMode
                ? `hover:bg-gray-700 border-gray-600 ${selectedContact?.wa_id === contact.wa_id ? 'bg-gray-700 border-l-4 border-l-green-500' : ''}`
                : `hover:bg-gray-50 border-gray-100 ${selectedContact?.wa_id === contact.wa_id ? 'bg-green-50 border-l-4 border-l-green-500' : ''}`
                }`}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold mr-2 sm:mr-3 text-sm sm:text-base">
                {contact.profile_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-semibold truncate ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {contact.profile_name}
                  </h3>
                  <span className={`text-xs ml-2 ${settings.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {contact.lastMessage && formatMessageTime(contact.lastMessage.timestamp)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-xs sm:text-sm truncate ${settings.darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {contact.lastMessage?.from === 'me' && (
                      <span className="inline-flex mr-1">
                        {getStatusIcon(contact.lastMessage.status)}
                      </span>
                    )}
                    {contact.lastMessage?.text?.body || 'No messages yet'}
                  </p>
                  {contact.unreadCount > 0 && (
                    <span className="bg-green-500 text-white text-xs rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 min-w-[18px] sm:min-w-[20px] text-center ml-2">
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
      <div className={`flex-1 flex flex-col ${settings.darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className={`flex items-center p-4 ${settings.darkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'} border-b`}>
              {/* Mobile Back Button */}
              <button
                onClick={() => setSelectedContact(null)}
                className="md:hidden mr-3 p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold mr-3">
                {selectedContact.profile_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className={`text-lg font-semibold ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {searchMode ? `Search in ${selectedContact.profile_name}` : selectedContact.profile_name}
                </h2>
                <p className={`text-sm ${settings.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {searchMode ? `${filteredMessages.length} results` : `+${selectedContact.wa_id}`}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Search
                  className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700"
                  onClick={handleSearchClick}
                />
                <div className="relative">
                  <MoreVertical
                    className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700"
                    onClick={handleChatMenuClick}
                  />
                  {showChatMenu && (
                    <div
                      ref={chatMenuRef}
                      className={`absolute right-0 top-8 rounded-lg shadow-lg border p-2 z-10 min-w-[180px] ${settings.darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}
                    >
                      <button
                        onClick={handleClearChat}
                        className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${settings.darkMode ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
                      >
                        Clear chat
                      </button>
                      <button
                        onClick={handleDeleteChat}
                        className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${settings.darkMode ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
                      >
                        Delete chat
                      </button>
                      <button
                        onClick={handleBlockContact}
                        className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${settings.darkMode ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
                      >
                        Block {selectedContact?.profile_name}
                      </button>
                      <button
                        onClick={handleReportContact}
                        className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${settings.darkMode ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
                      >
                        Report
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className={`flex-1 overflow-y-auto p-2 sm:p-4 ${settings.darkMode ? 'bg-gray-900' : 'bg-gray-50'}`} style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cdefs%3E%3Cpattern id="chat-bg" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse"%3E%3Cpath d="M0 100V.5h100" fill="none" stroke="%23f3f4f6" stroke-width=".5"/%3E%3C/pattern%3E%3C/defs%3E%3Crect width="100" height="100" fill="url(%23chat-bg)"/%3E%3C/svg%3E")'
            }}>
              <div className="space-y-3 sm:space-y-4 max-w-4xl mx-auto">
                {filteredMessages.map((message) => (
                  <div
                    key={message._id}
                    className={`flex ${message.from === 'me' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="relative max-w-[85%] sm:max-w-[70%] lg:max-w-[60%]">
                      {renderMessageContent(message)}
                      <div className={`flex items-center justify-end space-x-1 mt-1 ${message.from === 'me'
                        ? 'text-green-100'
                        : settings.darkMode
                          ? 'text-gray-400'
                          : 'text-gray-500'
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
            <div className={`p-2 sm:p-4 border-t ${settings.darkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
              <form onSubmit={handleSendMessage} className="flex items-center space-x-1 sm:space-x-2">
                {/* Attachment Menu */}
                <div className="relative">
                  <Paperclip
                    className="w-6 h-6 text-gray-500 cursor-pointer hover:text-gray-700"
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  />
                  {showAttachmentMenu && (
                    <div className={`attachment-menu absolute bottom-12 left-0 rounded-xl shadow-xl border p-2 sm:p-3 z-10 min-w-[180px] sm:min-w-[200px] ${settings.darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
                      {/* Arrow indicator */}
                      <div className={`absolute -bottom-2 left-4 w-4 h-4 border-b border-r transform rotate-45 ${settings.darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}></div>
                      <div className="space-y-1 sm:space-y-2">
                        {/* Photo Option */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={`w-full flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg transition-colors duration-200 ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                        >
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Image className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                          </div>
                          <div className="text-left">
                            <div className={`text-sm font-medium ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>Photo</div>
                            <div className={`text-xs ${settings.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Share images</div>
                          </div>
                        </button>

                        {/* Video Option */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={`w-full flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg transition-colors duration-200 ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                        >
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Video className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                          </div>
                          <div className="text-left">
                            <div className={`text-sm font-medium ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>Video</div>
                            <div className={`text-xs ${settings.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Share videos</div>
                          </div>
                        </button>

                        {/* Document Option */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={`w-full flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg transition-colors duration-200 ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                        >
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                          </div>
                          <div className="text-left">
                            <div className={`text-sm font-medium ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>Document</div>
                            <div className={`text-xs ${settings.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Share files</div>
                          </div>
                        </button>

                        {/* Voice Message Option */}
                        <button
                          type="button"
                          onClick={handleVoiceMessage}
                          className={`w-full flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg transition-colors duration-200 ${isRecording ? (settings.darkMode ? 'bg-red-900' : 'bg-red-50') : ''} ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                        >
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${isRecording ? 'bg-red-100' : 'bg-gray-100'}`}>
                            <Mic className={`w-4 h-4 sm:w-5 sm:h-5 ${isRecording ? 'text-red-600' : 'text-gray-600'}`} />
                          </div>
                          <div className="text-left">
                            <div className={`text-sm font-medium ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {isRecording ? 'Recording...' : 'Voice Message'}
                            </div>
                            <div className={`text-xs ${settings.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {isRecording ? 'Tap to stop' : 'Record audio'}
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message"
                    className={`w-full px-3 sm:px-4 py-2 sm:py-3 pr-10 sm:pr-12 rounded-full border focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${settings.darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                  />
                  <Smile
                    className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-gray-500 cursor-pointer hover:text-gray-700"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  />

                  {/* Emoji Picker */}
                  {showEmojiPicker && (
                    <div
                      ref={emojiPickerRef}
                      className="absolute bottom-12 right-0 z-10"
                    >
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={window.innerWidth < 640 ? 300 : 350}
                        height={window.innerWidth < 640 ? 300 : 400}
                        searchPlaceholder="Search emoji..."
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Welcome Screen */
          <div className={`flex-1 flex items-center justify-center ${settings.darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <div className="text-center">
              <div className="w-64 h-64 mx-auto mb-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center">
                  <div className="text-6xl font-bold text-green-500">W</div>
                </div>
              </div>
              <h1 className={`text-3xl font-light mb-4 ${settings.darkMode ? 'text-white' : 'text-gray-700'}`}>WhatsApp Web</h1>
              <p className={`max-w-md mx-auto leading-relaxed ${settings.darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                Send and receive messages without keeping your phone online. Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
              </p>
              <div className={`mt-8 text-sm ${settings.darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
                Select a chat to start messaging
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${settings.darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 max-w-md w-full mx-4`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div
                onClick={handleToggleNotifications}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
              >
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Notifications</span>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${settings.notifications ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 ${settings.notifications ? 'right-1' : 'left-1'}`}></div>
                </div>
              </div>
              <div
                onClick={handleToggleDarkMode}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
              >
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Dark Mode</span>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${settings.darkMode ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 ${settings.darkMode ? 'right-1' : 'left-1'}`}></div>
                </div>
              </div>
              <div
                onClick={handlePrivacyClick}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
              >
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Privacy</span>
                <span className="text-gray-400">{'>'}</span>
              </div>
              <div
                onClick={handleStorageClick}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
              >
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Storage and Data</span>
                <span className="text-gray-400">{'>'}</span>
              </div>
              <div
                onClick={handleHelpClick}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
              >
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Help</span>
                <span className="text-gray-400">{'>'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${settings.darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>New Group</h2>
              <button
                onClick={() => {
                  setShowNewGroup(false);
                  setGroupName('');
                  setSelectedContactsForGroup([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${settings.darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${settings.darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${settings.darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Select Contacts ({selectedContactsForGroup.length} selected)
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {contacts.map((contact) => (
                    <div
                      key={contact.wa_id}
                      onClick={() => handleToggleContactForGroup(contact.wa_id)}
                      className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${selectedContactsForGroup.includes(contact.wa_id)
                        ? 'bg-green-100 border border-green-300'
                        : 'hover:bg-gray-50'
                        }`}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold mr-3 text-sm">
                        {contact.profile_name.charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-sm ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>{contact.profile_name}</span>
                      {selectedContactsForGroup.includes(contact.wa_id) && (
                        <div className="ml-auto w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreateGroup}
                className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${settings.darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 max-w-md w-full mx-4`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setShowPrivacy(false);
                    setShowSettings(true);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ←
                </button>
                <h2 className={`text-xl font-semibold ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>Privacy</h2>
              </div>
              <button
                onClick={() => setShowPrivacy(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Last seen</span>
                <span className="text-gray-400">Everyone</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Profile photo</span>
                <span className="text-gray-400">Everyone</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>About</span>
                <span className="text-gray-400">Everyone</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Status</span>
                <span className="text-gray-400">My contacts</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Read receipts</span>
                <div className="w-10 h-6 bg-green-500 rounded-full relative">
                  <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Modal */}
      {showStorage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${settings.darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 max-w-md w-full mx-4`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setShowStorage(false);
                    setShowSettings(true);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ←
                </button>
                <h2 className={`text-xl font-semibold ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>Storage and Data</h2>
              </div>
              <button
                onClick={() => setShowStorage(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${settings.darkMode ? 'bg-blue-900' : 'bg-blue-50'}`}>
                <h3 className={`font-semibold mb-2 ${settings.darkMode ? 'text-blue-100' : 'text-blue-900'}`}>Storage Used</h3>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '35%' }}></div>
                </div>
                <p className={`text-sm ${settings.darkMode ? 'text-blue-200' : 'text-blue-700'}`}>2.1 GB of 6 GB used</p>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Auto-download media</span>
                <span className="text-gray-400">Wi-Fi only</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Reset statistics</span>
                <span className="text-gray-400">{'>'}</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Clear all chats</span>
                <span className="text-red-500">Clear</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${settings.darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 max-w-md w-full mx-4`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setShowHelp(false);
                    setShowSettings(true);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ←
                </button>
                <h2 className={`text-xl font-semibold ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>Help</h2>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${settings.darkMode ? 'bg-green-900' : 'bg-green-50'}`}>
                <h3 className={`font-semibold mb-2 ${settings.darkMode ? 'text-green-100' : 'text-green-900'}`}>WhatsApp Web Clone</h3>
                <p className={`text-sm mb-2 ${settings.darkMode ? 'text-green-200' : 'text-green-700'}`}>This is a demonstration of a WhatsApp Web-like interface built with React and Node.js.</p>
                <p className={`text-sm ${settings.darkMode ? 'text-green-200' : 'text-green-700'}`}>Features include real-time messaging, file sharing, and responsive design.</p>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>FAQ</span>
                <span className="text-gray-400">{'>'}</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Contact us</span>
                <span className="text-gray-400">{'>'}</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Privacy Policy</span>
                <span className="text-gray-400">{'>'}</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${settings.darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                <span className={settings.darkMode ? 'text-white' : 'text-gray-900'}>Terms of Service</span>
                <span className="text-gray-400">{'>'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;