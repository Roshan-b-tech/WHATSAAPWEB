import { spawn } from 'child_process';
import http from 'http';

console.log('🚀 Setting up WhatsApp Webhook Callback URL');
console.log('==========================================');

// Function to check if port is in use
function checkPort(port) {
    return new Promise((resolve) => {
        const server = http.createServer();
        server.listen(port, () => {
            server.close();
            resolve(false); // Port is available
        });
        server.on('error', () => {
            resolve(true); // Port is in use
        });
    });
}

// Function to start server
async function startServer() {
    console.log('📡 Starting server on port 3001...');

    const serverProcess = spawn('npm', ['run', 'dev'], {
        cwd: './server',
        stdio: 'inherit'
    });

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    return serverProcess;
}

// Function to start ngrok
function startNgrok() {
    console.log('🌐 Starting ngrok tunnel...');

    const ngrokProcess = spawn('ngrok', ['http', '3001'], {
        stdio: 'pipe'
    });

    ngrokProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output);

        // Look for the public URL
        const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.ngrok\.io/);
        if (match) {
            const publicUrl = match[0];
            console.log('\n✅ Your webhook callback URL is ready!');
            console.log('=====================================');
            console.log(`🌐 Public URL: ${publicUrl}`);
            console.log(`🔗 Callback URL: ${publicUrl}/webhook`);
            console.log('\n📝 Next steps:');
            console.log('1. Copy the callback URL above');
            console.log('2. Paste it in the "Callback URL" field in Meta for Developers');
            console.log('3. Generate a verify token using: node generate-token.js');
            console.log('4. Add the token to both your .env file and Meta for Developers');
        }
    });

    return ngrokProcess;
}

// Main execution
async function main() {
    try {
        // Check if port 3001 is available
        const portInUse = await checkPort(3001);
        if (portInUse) {
            console.log('⚠️  Port 3001 is already in use. Please stop any running servers.');
            return;
        }

        // Start server
        const serverProcess = await startServer();

        // Start ngrok
        const ngrokProcess = startNgrok();

        // Handle cleanup
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down...');
            serverProcess.kill();
            ngrokProcess.kill();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main();
