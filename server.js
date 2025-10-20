const express = require('express');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint (REQUIRED for Render)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Anime Card Bot by Zenon is running',
    timestamp: new Date().toISOString(),
    service: 'Anime Card Collector',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🎌 Anime Card Collector Bot by Zenon',
    status: 'Server is running smoothly',
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
      status: 'Active and Running'
    },
    server: {
      node_version: process.version,
      uptime: Math.floor(process.uptime()) + ' seconds',
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
    }
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('=================================');
  console.log('🚀 Server started successfully!');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🕒 Started at: ${new Date().toISOString()}`);
  console.log('=================================');
  
  // Import and start bot
  startBot();
});

// Bot starter function
function startBot() {
  try {
    console.log('🤖 Loading Anime Card Bot...');
    
    // Import bot file
    const botModule = require('./bot');
    
    if (botModule && botModule.bot) {
      console.log('✅ Bot loaded successfully!');
      console.log('🎴 Card drops: Active every 25 minutes');
      console.log('💬 Commands: Ready in DM and group');
      console.log('🛡️ Admin system: Operational');
    } else {
      console.log('⚠️ Bot loaded but may have issues');
    }
    
  } catch (error) {
    console.log('❌ Bot loading failed:', error.message);
    console.log('ℹ️ Server is running, but bot features disabled');
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT - Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM - Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;
