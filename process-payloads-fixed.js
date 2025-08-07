import fs from 'fs';
import path from 'path';
import axios from 'axios';

const API_BASE_URL = 'https://whatsaapweb.onrender.com';

// Function to process a single payload
async function processPayload(filePath) {
    try {
        const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`Processing: ${path.basename(filePath)}`);

        // Extract the actual webhook payload from the metaData
        const webhookPayload = payload.metaData;

        // Check if this is a message or status payload
        const changes = webhookPayload.entry[0].changes[0];
        const value = changes.value;

        if (changes.field === 'messages') {
            if (value.messages) {
                // This is a message payload
                console.log(`  📨 Processing message from ${value.contacts[0].profile.name}`);

                // Send to webhook endpoint
                const response = await axios.post(`${API_BASE_URL}/webhook`, webhookPayload);

                if (response.status === 200) {
                    console.log(`  ✅ Message processed successfully`);
                } else {
                    console.log(`  ❌ Failed to process message`);
                }
            } else if (value.statuses) {
                // This is a status payload
                console.log(`  📊 Processing status update`);

                // Send to webhook endpoint
                const response = await axios.post(`${API_BASE_URL}/webhook`, webhookPayload);

                if (response.status === 200) {
                    console.log(`  ✅ Status updated successfully`);
                } else {
                    console.log(`  ❌ Failed to update status`);
                }
            }
        }

        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
        console.error(`❌ Error processing ${path.basename(filePath)}:`, error.message);
    }
}

// Function to process all payloads in order
async function processAllPayloads() {
    console.log('🚀 Starting to process sample payloads...');
    console.log('=====================================');

    const payloadDir = './payload';
    const files = fs.readdirSync(payloadDir);

    // Sort files to process in logical order
    const sortedFiles = files.sort((a, b) => {
        // Extract conversation number and type
        const aMatch = a.match(/conversation_(\d+)_(message|status)_(\d+)/);
        const bMatch = b.match(/conversation_(\d+)_(message|status)_(\d+)/);

        if (!aMatch || !bMatch) return a.localeCompare(b);

        const aConv = parseInt(aMatch[1]);
        const bConv = parseInt(bMatch[1]);
        const aType = aMatch[2];
        const bType = bMatch[2];
        const aNum = parseInt(aMatch[3]);
        const bNum = parseInt(bMatch[3]);

        // Sort by conversation, then by type (message first, then status), then by number
        if (aConv !== bConv) return aConv - bConv;
        if (aType !== bType) return aType === 'message' ? -1 : 1;
        return aNum - bNum;
    });

    console.log('📁 Files to process:');
    sortedFiles.forEach(file => console.log(`  - ${file}`));
    console.log('');

    // Process each file
    for (const file of sortedFiles) {
        await processPayload(path.join(payloadDir, file));
    }

    console.log('');
    console.log('🎉 All payloads processed!');
    console.log('📱 Check your WhatsApp Web interface at: http://localhost:5173');
    console.log('🔗 Or visit your production URL to see the conversations');

    // Wait a moment then check the results
    setTimeout(async () => {
        console.log('\n📊 Checking results...');
        try {
            const contactsResponse = await axios.get(`${API_BASE_URL}/api/contacts`);
            console.log(`📞 Contacts found: ${contactsResponse.data.length}`);
            contactsResponse.data.forEach(contact => {
                console.log(`  - ${contact.profile_name} (${contact.wa_id})`);
            });
        } catch (error) {
            console.log('❌ Could not fetch contacts');
        }
    }, 2000);
}

// Run the script
processAllPayloads().catch(console.error);
