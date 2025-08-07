// Configuration for different environments
const config = {
    development: {
        apiUrl: 'http://localhost:3001',
        socketUrl: 'http://localhost:3001'
    },
    production: {
        apiUrl: 'https://whatsaapweb.onrender.com',
        socketUrl: 'https://whatsaapweb.onrender.com'
    }
};

// Use production by default, or development if NODE_ENV is set
const isDevelopment = import.meta.env.DEV;
const currentConfig = isDevelopment ? config.development : config.production;

export default currentConfig;
