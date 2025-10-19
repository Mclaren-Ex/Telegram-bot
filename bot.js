const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const moment = require('moment');
const axios = require('axios');

// Bot setup - YOUR ACTUAL TOKEN
const token = '8461726439:AAFRf0lB1QK9m0POjlwaJA0eV6nkW-Zjqjo';
const bot = new TelegramBot(token, { polling: true });

// Database setup
const db = new sqlite3.Database('./anime_cards.db');

// Store active trades, auctions, and banned users
const activeTrades = new Map();
const activeAuctions = new Map();
const userSessions = new Map();
const bannedUsers = new Map(); // user_id -> ban expiry timestamp
const activeRedeemCodes = new Map(); // code -> {card, expiry}

// Admin users - YOUR ACTUAL USER ID
const ADMINS = [6094186912];
const GROUP_ID = '-1003149343469';

// Initialize database
db.serialize(() => {
  // Users table with admin field
  db.run(`CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    registered_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    coins INTEGER DEFAULT 500,
    dust INTEGER DEFAULT 0,
    last_daily DATETIME,
    last_claim DATETIME,
    last_weekly DATETIME,
    inventory_slots INTEGER DEFAULT 100,
    battle_rank INTEGER DEFAULT 1,
    total_cards INTEGER DEFAULT 0,
    battles_won INTEGER DEFAULT 0,
    battles_lost INTEGER DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    achievement_points INTEGER DEFAULT 0,
    title TEXT DEFAULT 'Beginner',
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    energy INTEGER DEFAULT 100,
    last_energy_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_admin INTEGER DEFAULT 0,
    warnings INTEGER DEFAULT 0
  )`);

  // Cards table
  db.run(`CREATE TABLE IF NOT EXISTS cards (
    card_id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_name TEXT NOT NULL,
    card_anime TEXT NOT NULL,
    card_rarity TEXT NOT NULL,
    card_image TEXT,
    card_power INTEGER,
    card_element TEXT,
    card_series TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // User inventory
  db.run(`CREATE TABLE IF NOT EXISTS user_cards (
    user_card_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    card_id INTEGER,
    obtained_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_locked INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0,
    upgrade_level INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(user_id),
    FOREIGN KEY(card_id) REFERENCES cards(card_id)
  )`);

  // Achievements table
  db.run(`CREATE TABLE IF NOT EXISTS achievements (
    achievement_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    achievement_name TEXT,
    achievement_desc TEXT,
    achieved_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    reward_coins INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
  )`);

  // Market listings
  db.run(`CREATE TABLE IF NOT EXISTS market (
    listing_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    card_id INTEGER,
    price INTEGER,
    listed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_sold INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(user_id),
    FOREIGN KEY(card_id) REFERENCES cards(card_id)
  )`);

  // Initialize sample cards
  initializeSampleCards();
});

// 🛡️ BAN CHECK MIDDLEWARE
function checkBan(userId) {
  const banExpiry = bannedUsers.get(userId);
  if (banExpiry && Date.now() < banExpiry) {
    const minutesLeft = Math.ceil((banExpiry - Date.now()) / (1000 * 60));
    return `🚫 You are banned for ${minutesLeft} more minutes for violating rules.`;
  }
  if (banExpiry && Date.now() >= banExpiry) {
    bannedUsers.delete(userId); // Remove expired ban
  }
  return null;
}

// 🔧 ADMIN CHECK FUNCTION
function isAdmin(userId) {
  return ADMINS.includes(userId) || isUserAdminInDB(userId);
}

function isUserAdminInDB(userId) {
  return new Promise((resolve) => {
    db.get(`SELECT is_admin FROM users WHERE user_id = ?`, [userId], (err, user) => {
      resolve(user && user.is_admin === 1);
    });
  });
}

// 🎴 CARD DROP SYSTEM (GROUP ONLY)
cron.schedule('*/25 * * * *', () => {
  postRandomCardDrop();
});

cron.schedule('0 */6 * * *', () => {
  postSpecialEventCard();
});

cron.schedule('0 0 * * *', () => {
  resetDailyEnergy();
});

// 🚀 COMMAND HANDLERS

// START COMMAND - Works in both DM and Group
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isPrivate = msg.chat.type === 'private';
  const username = msg.from.username || msg.from.first_name;

  // Register user if not exists
  db.run(`INSERT OR IGNORE INTO users (user_id, username, coins) VALUES (?, ?, 500)`, [userId, username]);

  if (isPrivate) {
    showMainMenu(chatId, userId);
  } else {
    bot.sendMessage(chatId, 
      `👋 Hello ${username}! I'm *Anime Card Collector* by *Zenon*! 🎌\n\n` +
      `💬 *Message me privately* to manage your collection and use all game commands!\n\n` +
      `📨 Click here to start: @${bot.options.username}\n\n` +
      `🎴 *Group Commands:*\n` +
      `/redeem [code] - Claim card drops\n` +
      `/help - Show available commands`,
      { parse_mode: 'Markdown' }
    );
  }
});

// HELP COMMAND - Different responses for DM vs Group
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const isPrivate = msg.chat.type === 'private';

  if (isPrivate) {
    // DM Help - Full command list
    const helpText = `🎌 *Anime Card Bot by Zenon* - Complete Command List\n\n` +
      `🎴 *CARD COMMANDS:*\n` +
      `/collection - View your cards\n` +
      `/openpack - Open card pack (100 coins)\n` +
      `/upgrade [id] - Upgrade card\n` +
      `/fuse [id1] [id2] - Fuse cards\n\n` +
      `💰 *ECONOMY:*\n` +
      `/balance - Check coins & energy\n` +
      `/daily - Daily reward\n` +
      `/weekly - Weekly bonus\n` +
      `/shop - Buy items\n\n` +
      `⚔️ *BATTLE:*\n` +
      `/battle - Battle players\n` +
      `/leaderboard - Rankings\n\n` +
      `🤝 *TRADING:*\n` +
      `/trade - Start trade\n` +
      `/market - Marketplace\n\n` +
      `🏆 *PROFILE:*\n` +
      `/profile - Your stats\n` +
      `/achievements - Your badges\n\n` +
      `🎯 *Group-Only Commands:*\n` +
      `/redeem [code] - Claim card drops\n\n` +
      `⚙️ *Admin Commands:* (Admins only)\n` +
      `/admindrop - Force card drop\n` +
      `/ban [user] - Ban user\n` +
      `/warn [user] - Warn user\n` +
      `/broadcast - Send message to all users\n` +
      `/adminstats - Bot statistics`;

    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
  } else {
    // Group Help - Limited commands
    const helpText = `🎌 *Anime Card Bot by Zenon* - Group Commands\n\n` +
      `🎴 *Available in Group:*\n` +
      `/redeem [code] - Claim card drops\n` +
      `/help - Show this help\n\n` +
      `💬 *Full game available in private chat!*\n` +
      `Message me @${bot.options.username} to:\n` +
      `• Collect cards • Battle players • Trade cards\n` +
      `• Earn coins • Complete quests • Unlock achievements`;

    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
  }
});

// 🎴 REDEEM COMMAND - GROUP ONLY
bot.onText(/\/redeem (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isPrivate = msg.chat.type === 'private';
  const code = match[1].toUpperCase();

  // Only work in groups
  if (isPrivate) {
    bot.sendMessage(chatId, 
      `❌ The /redeem command only works in groups when card drops appear!\n\n` +
      `Join our group and wait for card drops every 25 minutes! 🎴`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Check if user is banned
  const banCheck = checkBan(userId);
  if (banCheck) {
    bot.sendMessage(chatId, banCheck);
    return;
  }

  // Check if code exists and is valid
  const redeemData = activeRedeemCodes.get(code);
  if (!redeemData) {
    bot.sendMessage(chatId, '❌ Invalid or expired redemption code!');
    return;
  }

  if (Date.now() > redeemData.expiry) {
    activeRedeemCodes.delete(code);
    bot.sendMessage(chatId, '❌ This code has expired!');
    return;
  }

  // Check if user already redeemed this code
  if (redeemData.redeemedBy && redeemData.redeemedBy.includes(userId)) {
    bot.sendMessage(chatId, '❌ You already redeemed this code!');
    return;
  }

  // Mark code as redeemed by this user
  if (!redeemData.redeemedBy) redeemData.redeemedBy = [];
  redeemData.redeemedBy.push(userId);

  // Add card to user's collection
  const card = redeemData.card;
  db.run(`INSERT INTO user_cards (user_id, card_id) VALUES (?, ?)`, [userId, card.card_id || 1], function(err) {
    if (err) {
      console.error('Error adding card:', err);
      bot.sendMessage(chatId, '❌ Error redeeming card!');
      return;
    }

    // Update user stats
    db.run(`UPDATE users SET total_cards = total_cards + 1 WHERE user_id = ?`, [userId]);

    const rarityEmojis = {
      'Common': '🟢', 'Rare': '🔵', 'Epic': '🟣', 
      'Legendary': '🟡', 'Mythical': '🔴'
    };

    const successMessage = `🎉 *CARD REDEEMED SUCCESSFULLY!*\n\n` +
      `${rarityEmojis[card.rarity]} **${card.name}**\n` +
      `📺 Anime: ${card.anime}\n` +
      `⭐ Rarity: ${card.rarity}\n` +
      `⚡ Power: ${card.power}\n` +
      `🌀 Element: ${card.element}\n\n` +
      `💫 Card added to your collection! Check your DM.`;

    bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });

    // Send confirmation to user's DM
    try {
      bot.sendMessage(userId,
        `🎴 *New Card Obtained!*\n\n` +
        `You redeemed: **${card.name}**\n` +
        `From group drop - Code: ${code}\n\n` +
        `Use /collection to view your cards!`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.log('Could not DM user');
    }
  });
});

// 🛡️ ADMIN COMMANDS

// ADMIN DROP - Force card drop in group
bot.onText(/\/admindrop/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isPrivate = msg.chat.type === 'private';

  if (!(await isUserAdminInDB(userId)) && !ADMINS.includes(userId)) {
    bot.sendMessage(chatId, '❌ Admin only command!');
    return;
  }

  if (isPrivate) {
    bot.sendMessage(chatId, '❌ This command only works in groups!');
    return;
  }

  bot.sendMessage(chatId, '🎴 Admin forcing card drop...');
  postRandomCardDrop();
});

// BAN USER - Admin only
bot.onText(/\/ban (@\w+|\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const adminId = msg.from.id;
  const target = match[1];

  if (!(await isUserAdminInDB(adminId)) && !ADMINS.includes(adminId)) {
    bot.sendMessage(chatId, '❌ Admin only command!');
    return;
  }

  let targetUserId;
  
  // Handle both user ID and username
  if (target.startsWith('@')) {
    targetUserId = await getUserIdFromUsername(target.slice(1));
  } else {
    targetUserId = parseInt(target);
  }

  if (!targetUserId) {
    bot.sendMessage(chatId, '❌ User not found! Use their user ID or @username');
    return;
  }

  // Ban for 10 minutes
  const banDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
  bannedUsers.set(targetUserId, Date.now() + banDuration);

  bot.sendMessage(chatId, 
    `🚫 User has been banned for 10 minutes!\n` +
    `⏰ They will be automatically unbanned at ${new Date(Date.now() + banDuration).toLocaleTimeString()}`,
    { parse_mode: 'Markdown' }
  );

  // Notify the banned user if possible
  try {
    bot.sendMessage(targetUserId, 
      `🚫 *You have been banned for 10 minutes!*\n\n` +
      `Reason: Violating group rules\n` +
      `Ban expires: ${new Date(Date.now() + banDuration).toLocaleTimeString()}\n\n` +
      `Please follow the rules to avoid longer bans.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.log('Could not DM banned user');
  }
});

// UNBAN USER - Admin only
bot.onText(/\/unban (@\w+|\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const adminId = msg.from.id;
  const target = match[1];

  if (!(await isUserAdminInDB(adminId)) && !ADMINS.includes(adminId)) {
    bot.sendMessage(chatId, '❌ Admin only command!');
    return;
  }

  let targetUserId;
  
  if (target.startsWith('@')) {
    targetUserId = await getUserIdFromUsername(target.slice(1));
  } else {
    targetUserId = parseInt(target);
  }

  if (!targetUserId) {
    bot.sendMessage(chatId, '❌ User not found!');
    return;
  }

  bannedUsers.delete(targetUserId);
  bot.sendMessage(chatId, `✅ User has been unbanned!`);
});

// WARN USER - Admin only
bot.onText(/\/warn (@\w+|\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const adminId = msg.from.id;
  const target = match[1];

  if (!(await isUserAdminInDB(adminId)) && !ADMINS.includes(adminId)) {
    bot.sendMessage(chatId, '❌ Admin only command!');
    return;
  }

  let targetUserId;
  
  if (target.startsWith('@')) {
    targetUserId = await getUserIdFromUsername(target.slice(1));
  } else {
    targetUserId = parseInt(target);
  }

  if (!targetUserId) {
    bot.sendMessage(chatId, '❌ User not found!');
    return;
  }

  // Add warning to user
  db.run(`UPDATE users SET warnings = warnings + 1 WHERE user_id = ?`, [targetUserId]);

  db.get(`SELECT warnings FROM users WHERE user_id = ?`, [targetUserId], (err, user) => {
    const warnings = user?.warnings || 1;
    
    bot.sendMessage(chatId, 
      `⚠️ User warned! Total warnings: ${warnings}/3\n` +
      `🚫 3 warnings will result in automatic ban.`,
      { parse_mode: 'Markdown' }
    );

    // Auto-ban after 3 warnings
    if (warnings >= 3) {
      const banDuration = 10 * 60 * 1000;
      bannedUsers.set(targetUserId, Date.now() + banDuration);
      db.run(`UPDATE users SET warnings = 0 WHERE user_id = ?`, [targetUserId]);
      
      bot.sendMessage(chatId, 
        `🚫 Auto-ban activated! User reached 3 warnings.\n` +
        `⏰ Banned for 10 minutes.`,
        { parse_mode: 'Markdown' }
      );
    }

    // Notify warned user
    try {
      bot.sendMessage(targetUserId, 
        `⚠️ *You have received a warning!*\n\n` +
        `Total warnings: ${warnings}/3\n` +
        `🚫 3 warnings will result in automatic ban.\n\n` +
        `Please follow the group rules.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.log('Could not DM warned user');
    }
  });
});

// BROADCAST - Admin only (DM only)
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const adminId = msg.from.id;
  const message = match[1];
  const isPrivate = msg.chat.type === 'private';

  if (!(await isUserAdminInDB(adminId)) && !ADMINS.includes(adminId)) {
    bot.sendMessage(chatId, '❌ Admin only command!');
    return;
  }

  if (!isPrivate) {
    bot.sendMessage(chatId, '❌ Broadcast can only be used in private chat!');
    return;
  }

  bot.sendMessage(chatId, '📢 Starting broadcast to all users...');

  // Get all users from database
  db.all(`SELECT user_id FROM users`, async (err, users) => {
    if (err) {
      bot.sendMessage(chatId, '❌ Error getting user list!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await bot.sendMessage(user.user_id, 
          `📢 *Announcement from Admin:*\n\n${message}\n\n- Zenon Bot Team`,
          { parse_mode: 'Markdown' }
        );
        success++;
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        failed++;
      }
    }

    bot.sendMessage(chatId, 
      `📊 Broadcast completed!\n\n` +
      `✅ Success: ${success} users\n` +
      `❌ Failed: ${failed} users`,
      { parse_mode: 'Markdown' }
    );
  });
});

// ADMIN STATS - Admin only
bot.onText(/\/adminstats/, async (msg) => {
  const chatId = msg.chat.id;
  const adminId = msg.from.id;

  if (!(await isUserAdminInDB(adminId)) && !ADMINS.includes(adminId)) {
    bot.sendMessage(chatId, '❌ Admin only command!');
    return;
  }

  db.get(`SELECT COUNT(*) as total_users FROM users`, (err, userCount) => {
    db.get(`SELECT COUNT(*) as total_cards FROM user_cards`, (err, cardCount) => {
      db.get(`SELECT COUNT(*) as active_bans FROM users WHERE warnings >= 1`, (err, warnCount) => {
        
        const statsText = `📊 *Admin Statistics*\n\n` +
          `👥 Total Users: ${userCount.total_users}\n` +
          `🎴 Total Cards Collected: ${cardCount.total_cards}\n` +
          `⚠️ Users with Warnings: ${warnCount.active_bans}\n` +
          `🚫 Currently Banned: ${bannedUsers.size}\n` +
          `🤖 Bot by: Zenon\n` +
          `🕒 Uptime: ${formatUptime(process.uptime())}`;

        bot.sendMessage(chatId, statsText, { parse_mode: 'Markdown' });
      });
    });
  });
});

// 🎴 GAME COMMANDS - DM ONLY

// COLLECTION - DM only
bot.onText(/\/collection/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isPrivate = msg.chat.type === 'private';

  if (!isPrivate) {
    bot.sendMessage(chatId, '❌ Please use this command in private chat with the bot!');
    return;
  }

  showCollectionMenu(chatId, userId);
});

// BALANCE - DM only
bot.onText(/\/balance/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isPrivate = msg.chat.type === 'private';

  if (!isPrivate) {
    bot.sendMessage(chatId, '❌ Please use this command in private chat!');
    return;
  }

  db.get(`SELECT coins, energy FROM users WHERE user_id = ?`, [userId], (err, user) => {
    if (!user) {
      bot.sendMessage(chatId, '❌ Please use /start first!');
      return;
    }

    bot.sendMessage(chatId, 
      `💰 *Your Balance*\n\n` +
      `🪙 Coins: ${user.coins}\n` +
      `⚡ Energy: ${user.energy}/100\n\n` +
      `Use /daily to claim free coins!`,
      { parse_mode: 'Markdown' }
    );
  });
});

// DAILY REWARD - DM only
bot.onText(/\/daily/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isPrivate = msg.chat.type === 'private';

  if (!isPrivate) {
    bot.sendMessage(chatId, '❌ Please use this command in private chat!');
    return;
  }

  db.get(`SELECT last_daily, coins FROM users WHERE user_id = ?`, [userId], (err, user) => {
    if (!user) {
      bot.sendMessage(chatId, '❌ Please use /start first!');
      return;
    }

    const now = new Date();
    if (user.last_daily) {
      const lastDaily = new Date(user.last_daily);
      const hoursDiff = (now - lastDaily) / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        const hoursLeft = 24 - hoursDiff;
        bot.sendMessage(chatId, 
          `⏰ You already claimed your daily reward!\n\n🕒 Come back in ${Math.ceil(hoursLeft)} hours!`);
        return;
      }
    }

    const dailyCoins = 100 + Math.floor(Math.random() * 50);
    db.run(`UPDATE users SET coins = coins + ?, last_daily = ? WHERE user_id = ?`, 
      [dailyCoins, now, userId], function(err) {
      if (err) {
        bot.sendMessage(chatId, '❌ Error claiming daily reward!');
        return;
      }

      bot.sendMessage(chatId, 
        `🎉 *Daily Reward Claimed!*\n\n` +
        `🪙 +${dailyCoins} coins!\n\n` +
        `Come back in 24 hours for more!`,
        { parse_mode: 'Markdown' }
      );
    });
  });
});

// BATTLE - DM only  
bot.onText(/\/battle/, (msg) => {
  const chatId = msg.chat.id;
  const isPrivate = msg.chat.type === 'private';

  if (!isPrivate) {
    bot.sendMessage(chatId, '❌ Please use this command in private chat!');
    return;
  }

  const battleText = `⚔️ *BATTLE ARENA*\n\n` +
    `Choose your battle mode:\n\n` +
    `🎯 Quick Battle - Fight random opponent\n` +
    `🏆 Ranked Match - Earn ranking points\n` +
    `👥 Team Battle - 3v3 card showdown\n` +
    `🤖 AI Challenge - Practice against bot\n\n` +
    `⚡ Energy Cost: 10 per battle\n` +
    `💰 Rewards: Coins, EXP, and rare cards!`;

  bot.sendMessage(chatId, battleText, { parse_mode: 'Markdown' });
});

// PROFILE - DM only
bot.onText(/\/profile/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isPrivate = msg.chat.type === 'private';

  if (!isPrivate) {
    bot.sendMessage(chatId, '❌ Please use this command in private chat!');
    return;
  }

  db.get(`SELECT * FROM users WHERE user_id = ?`, [userId], (err, user) => {
    if (!user) {
      bot.sendMessage(chatId, '❌ Please use /start first!');
      return;
    }

    db.get(`SELECT COUNT(*) as total_cards FROM user_cards WHERE user_id = ?`, [userId], (err, cards) => {
      const level = user.level || 1;
      const exp = user.exp || 0;
      const expNeeded = level * 100;
      const progress = Math.min((exp / expNeeded) * 100, 100);
      const progressBar = createProgressBar(progress);

      const profileText = `🏆 *PLAYER PROFILE*\n\n` +
        `👤 ${user.username || 'Player'}\n` +
        `🎯 ${user.title || 'Beginner Collector'}\n\n` +
        `📊 *Stats:*\n` +
        `⭐ Level: ${level}\n` +
        `📈 EXP: ${exp}/${expNeeded}\n` +
        `${progressBar}\n` +
        `🎴 Cards: ${cards.total_cards}\n` +
        `🪙 Coins: ${user.coins}\n` +
        `💎 Dust: ${user.dust}\n` +
        `⚡ Energy: ${user.energy}/100\n\n` +
        `⚔️ *Battle Record:*\n` +
        `🏆 Wins: ${user.battles_won || 0}\n` +
        `💔 Losses: ${user.battles_lost || 0}\n` +
        `🤝 Trades: ${user.total_trades || 0}`;

      bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
    });
  });
});

// SHOP - DM only
bot.onText(/\/shop/, (msg) => {
  const chatId = msg.chat.id;
  const isPrivate = msg.chat.type === 'private';

  if (!isPrivate) {
    bot.sendMessage(chatId, '❌ Please use this command in private chat!');
    return;
  }

  const shopText = `🛍️ *CARD SHOP*\n\n` +
    `🎴 *CARD PACKS:*\n` +
    `• Starter Pack - 🪙100 (3 Common Cards)\n` +
    `• Advanced Pack - 🪙300 (2 Rare, 1 Epic)\n` +
    `• Premium Pack - 🪙500 (1 Legendary Guaranteed)\n\n` +
    `🎨 *COSMETICS:*\n` +
    `• Name Color - 🪙200\n` +
    `• Special Frame - 🪙150\n` +
    `• Profile Badge - 🪙300\n\n` +
    `Use /buy [item] to purchase!`;

  bot.sendMessage(chatId, shopText, { parse_mode: 'Markdown' });
});

// LEADERBOARD - DM only
bot.onText(/\/leaderboard/, (msg) => {
  const chatId = msg.chat.id;
  const isPrivate = msg.chat.type === 'private';

  if (!isPrivate) {
    bot.sendMessage(chatId, '❌ Please use this command in private chat!');
    return;
  }

  db.all(`SELECT username, total_cards, coins, level FROM users ORDER BY total_cards DESC LIMIT 10`, (err, users) => {
    let leaderboardText = `🏆 *GLOBAL LEADERBOARD*\n\n`;

    users.forEach((user, index) => {
      const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `▫️`;
      leaderboardText += `${rankEmoji} *${user.username || 'Anonymous'}*\n`;
      leaderboardText += `   🎴 ${user.total_cards} cards | ⭐ Lvl ${user.level}\n\n`;
    });

    bot.sendMessage(chatId, leaderboardText, { parse_mode: 'Markdown' });
  });
});

// 🎴 CARD DROP FUNCTION (Group only)
function postRandomCardDrop() {
  const sampleCards = [
    { 
      name: 'Naruto (Six Paths)', 
      anime: 'Naruto', 
      rarity: 'Legendary', 
      power: 950, 
      element: 'Six Paths',
      card_id: 1
    },
    { 
      name: 'Luffy (Gear 5)', 
      anime: 'One Piece', 
      rarity: 'Legendary', 
      power: 980, 
      element: 'Sun God',
      card_id: 2
    },
    { 
      name: 'Goku (Ultra Instinct)', 
      anime: 'Dragon Ball', 
      rarity: 'Legendary', 
      power: 1000, 
      element: 'Ultra Instinct',
      card_id: 3
    },
    { 
      name: 'Gojo Satoru', 
      anime: 'Jujutsu Kaisen', 
      rarity: 'Epic', 
      power: 480, 
      element: 'Limitless',
      card_id: 4
    },
    { 
      name: 'Tanjiro (Hinokami)', 
      anime: 'Demon Slayer', 
      rarity: 'Epic', 
      power: 470, 
      element: 'Sun Breathing',
      card_id: 5
    },
    { 
      name: 'Sung Jin-Woo (Shadow)', 
      anime: 'Solo Leveling', 
      rarity: 'Epic', 
      power: 490, 
      element: 'Shadow',
      card_id: 6
    },
    { 
      name: 'Levi Ackerman', 
      anime: 'Attack on Titan', 
      rarity: 'Rare', 
      power: 180, 
      element: 'Ackerman',
      card_id: 7
    },
    { 
      name: 'Zoro (Three Sword)', 
      anime: 'One Piece', 
      rarity: 'Rare', 
      power: 190, 
      element: 'Swordsman',
      card_id: 8
    }
  ];

  const card = sampleCards[Math.floor(Math.random() * sampleCards.length)];
  const redeemCode = generateRedeemCode();

  // Store the redeem code (expires in 5 minutes)
  activeRedeemCodes.set(redeemCode, {
    card: card,
    expiry: Date.now() + (5 * 60 * 1000), // 5 minutes
    redeemedBy: []
  });

  const rarityEmojis = { 
    'Common': '🟢', 
    'Rare': '🔵', 
    'Epic': '🟣', 
    'Legendary': '🟡', 
    'Mythical': '🔴' 
  };

  const message = `
🎴 **CARD DROP!** by *Zenon Bot* 🎌

${rarityEmojis[card.rarity]} **${card.name}**
📺 Anime: ${card.anime}
⭐ Rarity: ${card.rarity}
⚡ Power: ${card.power}
🌀 Element: ${card.element}

💎 **Use this code to claim:**
\`/redeem ${redeemCode}\`

⏰ **First come, first serve!**
🔒 *Code expires in 5 minutes*
  `;

  bot.sendMessage(GROUP_ID, message, { parse_mode: 'Markdown' });

  // Auto-remove expired code after 5 minutes
  setTimeout(() => {
    if (activeRedeemCodes.has(redeemCode)) {
      activeRedeemCodes.delete(redeemCode);
    }
  }, 5 * 60 * 1000);
}

// 🛠️ HELPER FUNCTIONS
function generateRedeemCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function showMainMenu(chatId, userId) {
  const menuText = `🎌 *Anime Card Collector by Zenon* 🎴

🏠 **Main Menu** - Choose a command:

🎴 *Card Management*
/collection - View your cards
/balance - Check coins & energy
/daily - Claim daily reward
/shop - Buy card packs

⚔️ *Gameplay*
/battle - Battle players
/leaderboard - Rankings

🤝 *Social*
/trade - Start trading
/market - Marketplace

🏆 *Profile*
/profile - Your stats
/achievements - Progress

❓ *Help*
/help - All commands

✨ *Group Features:*
• Card drops every 25 minutes!
• Use /redeem in group to claim cards
• Compete with other collectors!`;

  bot.sendMessage(chatId, menuText, { parse_mode: 'Markdown' });
}

function showCollectionMenu(chatId, userId) {
  db.get(`SELECT COUNT(*) as total FROM user_cards WHERE user_id = ?`, [userId], (err, result) => {
    const totalCards = result.total;
    
    db.all(`SELECT c.card_rarity, COUNT(*) as count FROM user_cards uc 
            JOIN cards c ON uc.card_id = c.card_id 
            WHERE uc.user_id = ? GROUP BY c.card_rarity`, [userId], (err, rarityStats) => {
      
      let collectionText = `🎴 *YOUR COLLECTION*\n\n`;
      collectionText += `📊 Total Cards: ${totalCards}/100\n\n`;
      
      const rarityEmojis = { 'Common': '🟢', 'Rare': '🔵', 'Epic': '🟣', 'Legendary': '🟡', 'Mythical': '🔴' };
      
      if (rarityStats.length > 0) {
        rarityStats.forEach(stat => {
          collectionText += `${rarityEmojis[stat.card_rarity]} ${stat.card_rarity}: ${stat.count}\n`;
        });
      } else {
        collectionText += `No cards yet! Redeem codes in the group!\n`;
      }
      
      collectionText += `\n✨ *Collection Commands:*\n`;
      collectionText += `/view [id] - View specific card\n`;
      collectionText += `/upgrade [id] - Upgrade card\n`;
      collectionText += `/fuse [id1] [id2] - Combine cards`;

      bot.sendMessage(chatId, collectionText, { parse_mode: 'Markdown' });
    });
  });
}

async function getUserIdFromUsername(username) {
  // This would require storing username->userID mapping
  // For now, return null - you'd need to implement this
  return null;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  
  return `${days}d ${hours}h ${minutes}m`;
}

function createProgressBar(percentage) {
  const bars = 10;
  const filled = Math.round((percentage / 100) * bars);
  const empty = bars - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round(percentage)}%`;
}

function initializeSampleCards() {
  const sampleCards = [
    ['Naruto Uzumaki', 'Naruto', 'Common', '', 50, 'Wind'],
    ['Sasuke Uchiha', 'Naruto', 'Common', '', 55, 'Fire'],
    ['Luffy (Pre-Timeskip)', 'One Piece', 'Common', '', 60, 'Rubber'],
    ['Goku (Kid)', 'Dragon Ball', 'Common', '', 45, 'Martial Arts'],
    ['Gojo Satoru', 'Jujutsu Kaisen', 'Epic', '', 480, 'Limitless'],
    ['Sukuna', 'Jujutsu Kaisen', 'Legendary', '', 900, 'Cursed Energy']
  ];

  const insertStmt = db.prepare(`INSERT OR IGNORE INTO cards 
    (card_name, card_anime, card_rarity, card_image, card_power, card_element) 
    VALUES (?, ?, ?, ?, ?, ?)`);
  
  sampleCards.forEach(card => {
    insertStmt.run(card);
  });
  insertStmt.finalize();

  console.log('🎌 Sample cards initialized!');
}

function postSpecialEventCard() {
  // Special event card implementation
  console.log('🎉 Special event card feature ready!');
}

function resetDailyEnergy() {
  db.run(`UPDATE users SET energy = 100, last_energy_update = CURRENT_TIMESTAMP`);
  console.log('⚡ Daily energy reset!');
}

// 🚀 BOT STARTUP MESSAGE
console.log('=================================');
console.log('🎌 Anime Card Bot by Zenon');
console.log('🤖 Bot Token: 8461726439:AAFRf0lB1QK9m0POjlwaJA0eV6nkW-Zjqjo');
console.log('👥 Group ID: -1003149343469');
console.log('👑 Admin ID: 6094186912');
console.log('🎴 Card drops: Every 25 minutes');
console.log('🛡️ Admin system: Active');
console.log('🚫 Ban system: Active (10min)');
console.log('💬 DM commands: Full game features');
console.log('👥 Group commands: /redeem only');
console.log('=================================');

// Error handling
bot.on('error', (error) => {
  console.error('Bot Error:', error);
});

bot.on('polling_error', (error) => {
  console.error('Polling Error:', error);
});

module.exports = { bot, db };