import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// Script to process sample webhook payloads from the provided zip file
class WebhookProcessor {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect() {
    try {
      this.client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
      await this.client.connect();
      this.db = this.client.db('whatsapp');
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('Disconnected from MongoDB');
    }
  }

  async processPayloadFile(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const payload = JSON.parse(data);
      
      console.log(`Processing file: ${path.basename(filePath)}`);
      await this.processWebhookPayload(payload);
      
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }

  async processWebhookPayload(payload) {
    try {
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
                meta_msg_id: message.id,
                from: message.from,
                to: changes.value.metadata?.phone_number_id || 'business',
                text: message.text,
                timestamp: parseInt(message.timestamp) * 1000,
                type: message.type,
                status: 'received',
                wa_id: message.from,
                profile_name: contacts?.[0]?.profile?.name || message.from
              };

              await this.db.collection('processed_messages').updateOne(
                { id: message.id },
                { $set: processedMessage },
                { upsert: true }
              );

              console.log(`Inserted/Updated message: ${message.id}`);
            }
          }

          // Process status updates
          if (statuses) {
            for (const status of statuses) {
              const result = await this.db.collection('processed_messages').updateOne(
                { 
                  $or: [
                    { id: status.id },
                    { meta_msg_id: status.id }
                  ]
                },
                { 
                  $set: { 
                    status: status.status,
                    status_timestamp: parseInt(status.timestamp) * 1000
                  }
                }
              );

              if (result.matchedCount > 0) {
                console.log(`Updated message status: ${status.id} -> ${status.status}`);
              } else {
                console.log(`No message found for status update: ${status.id}`);
              }
            }
          }

          // Process contacts
          if (contacts) {
            for (const contact of contacts) {
              await this.db.collection('contacts').updateOne(
                { wa_id: contact.wa_id },
                { 
                  $set: { 
                    profile_name: contact.profile?.name || contact.wa_id,
                    wa_id: contact.wa_id,
                    updated_at: new Date()
                  }
                },
                { upsert: true }
              );

              console.log(`Updated contact: ${contact.wa_id}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing webhook payload:', error);
    }
  }

  async processDirectory(directoryPath) {
    try {
      const files = fs.readdirSync(directoryPath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      console.log(`Found ${jsonFiles.length} JSON files to process`);

      for (const file of jsonFiles) {
        const filePath = path.join(directoryPath, file);
        await this.processPayloadFile(filePath);
      }

      console.log('Processing complete!');
    } catch (error) {
      console.error('Error processing directory:', error);
    }
  }
}

// Usage example
const processor = new WebhookProcessor();

async function main() {
  try {
    await processor.connect();
    
    // Process sample payloads from the downloaded zip file
    // Replace 'path/to/extracted/payloads' with the actual path to your extracted payload files
    const payloadsDirectory = './sample-payloads';
    
    if (fs.existsSync(payloadsDirectory)) {
      await processor.processDirectory(payloadsDirectory);
    } else {
      console.log(`Directory ${payloadsDirectory} not found. Please extract the sample payloads zip file and update the path.`);
      
      // Create sample payloads for demonstration
      await createSamplePayloads();
      await processor.processDirectory(payloadsDirectory);
    }
    
  } catch (error) {
    console.error('Main execution error:', error);
  } finally {
    await processor.disconnect();
  }
}

async function createSamplePayloads() {
  const payloadsDir = './sample-payloads';
  if (!fs.existsSync(payloadsDir)) {
    fs.mkdirSync(payloadsDir);
  }

  // Sample message payload
  const messagePayload = {
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "102290129340398",
        "changes": [
          {
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "15550123456",
                "phone_number_id": "102290129340398"
              },
              "contacts": [
                {
                  "profile": {
                    "name": "John Doe"
                  },
                  "wa_id": "1234567890"
                }
              ],
              "messages": [
                {
                  "from": "1234567890",
                  "id": "wamid.HBgNMTIzNDU2Nzg5MAoSEhgKRTg0ODEwMUHWh_Cg1_E",
                  "timestamp": "1625097600",
                  "text": {
                    "body": "Hello, this is a test message!"
                  },
                  "type": "text"
                }
              ]
            },
            "field": "messages"
          }
        ]
      }
    ]
  };

  // Sample status payload
  const statusPayload = {
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "102290129340398",
        "changes": [
          {
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "15550123456",
                "phone_number_id": "102290129340398"
              },
              "statuses": [
                {
                  "id": "wamid.HBgNMTIzNDU2Nzg5MAoSEhgKRTg0ODEwMUHWh_Cg1_E",
                  "status": "delivered",
                  "timestamp": "1625097660",
                  "recipient_id": "1234567890"
                }
              ]
            },
            "field": "messages"
          }
        ]
      }
    ]
  };

  fs.writeFileSync(path.join(payloadsDir, 'message_payload.json'), JSON.stringify(messagePayload, null, 2));
  fs.writeFileSync(path.join(payloadsDir, 'status_payload.json'), JSON.stringify(statusPayload, null, 2));

  console.log('Created sample payload files');
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default WebhookProcessor;