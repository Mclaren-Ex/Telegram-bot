const express = require('express');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());

// Health check endpoint (REQUIRED for Render)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Anime Card Bot is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🎌 Anime Card Collector Bot by Zenon',
    status: 'Server is running',
    health: '/health'
  });
});

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('=================================');
  console.log('🚀 Server started successfully!');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
  console.log('=================================');
  
  // Start the bot after server is running
  startBot();
});

// Import and start the bot
function startBot() {
  try {
    console.log('🤖 Starting Anime Card Bot...');
    
    // Import bot components
    const TelegramBot = require('node-telegram-bot-api');
    const sqlite3 = require('sqlite3').verbose();
    const cron = require('node-cron');

    // Bot setup
    const token = '8461726439:AAFRf0lB1QK9m0POjlwaJA0eV6nkW-Zjqjo';
    const bot = new TelegramBot(token, { polling: true });
    const db = new sqlite3.Database('./anime_cards.db');

    console.log('✅ Bot initialized successfully');
    
    // Initialize database
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        coins INTEGER DEFAULT 500
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS cards (
        card_id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_name TEXT,
        card_anime TEXT,
        card_rarity TEXT
      )`);
      
      console.log('✅ Database initialized');
    });

    // Simple start command
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId, '🎌 Anime Card Bot by Zenon is running!');
    });

    // Card drop system
    cron.schedule('*/25 * * * *', () => {
      console.log('🕒 Card drop scheduled task running...');
      // Add your card drop logic here
    });

    console.log('✅ Bot commands registered');
    console.log('✅ Cron jobs scheduled');
    console.log('🤖 Anime Card Bot is now LIVE!');
    console.log('🎴 Card drops every 25 minutes');
    console.log('=================================');

    return { bot, db };
    
  } catch (error) {
    console.error('❌ Bot startup error:', error);
    return null;
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
