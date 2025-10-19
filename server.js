const express = require('express');
const http = require('http');
const path = require('path');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Anime Card Bot by Zenon',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🎌 Anime Card Collector Bot by Zenon',
    status: 'Running',
    endpoints: {
      health: '/health',
      status: '/status'
    }
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    bot: {
      name: 'Anime Card Collector',
      creator: 'Zenon',
      version: '1.0.0',
      status: 'Active'
    },
    system: {
      node_version: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime()) + ' seconds',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      }
    }
  });
});

// Import and start the bot
function startBot() {
  try {
    const bot = require('./bot');
    console.log('🤖 Bot module loaded successfully');
    return bot;
  } catch (error) {
    console.error('❌ Failed to load bot module:', error.message);
    return null;
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: ['/', '/health', '/status']
  });
});

// Create HTTP server
const server = http.createServer(app);

// Start server
server.listen(PORT, () => {
  console.log('🚀 Server started successfully!');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🕒 Started at: ${new Date().toISOString()}`);
  console.log('=================================');
  
  // Start the bot after server is running
  const bot = startBot();
  if (bot) {
    console.log('✅ Bot integration: Active');
  } else {
    console.log('❌ Bot integration: Failed');
  }
  
  console.log('=================================');
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed.');
    process.exit(0);
  });
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

module.exports = server;
