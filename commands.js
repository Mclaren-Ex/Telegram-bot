const db = require('./bot').db;
const bot = require('./bot').bot;

// Command handlers
const commands = {
  // 🎯 CARD COMMANDS
  async register(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    
    return new Promise((resolve) => {
      db.run(`INSERT OR IGNORE INTO users (user_id, username, coins) VALUES (?, ?, 100)`, 
        [userId, username], function(err) {
        if (err) {
          bot.sendMessage(chatId, '❌ Registration failed!');
          resolve(false);
          return;
        }
        
        if (this.changes === 0) {
          bot.sendMessage(chatId, '✅ You are already registered!');
        } else {
          bot.sendMessage(chatId, 
            `🎉 Welcome ${username}! You received 100 starter coins! 🪙\nUse /daily to claim more coins!`);
        }
        resolve(true);
      });
    });
  },

  async redeem(msg, match) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const code = match[1];
    
    if (!code) {
      bot.sendMessage(chatId, '❌ Please provide a code: `/redeem CODE123`');
      return;
    }
    
    // Check if code is valid (you'll need to implement code validation)
    const isValid = await validateRedeemCode(code);
    if (!isValid) {
      bot.sendMessage(chatId, '❌ Invalid or expired code!');
      return;
    }
    
    // Get random card based on code rarity
    const card = await getRandomCardForCode(code);
    if (card) {
      db.run(`INSERT INTO user_cards (user_id, card_id) VALUES (?, ?)`, 
        [userId, card.card_id], function(err) {
        if (err) {
          bot.sendMessage(chatId, '❌ Failed to redeem card!');
          return;
        }
        
        const rarityEmojis = {
          'Common': '🟢', 'Rare': '🔵', 'Epic': '🟣', 
          'Legendary': '🟡', 'Mythical': '🔴'
        };
        
        const message = `
🎴 **CARD REDEEMED!** 🎴

${rarityEmojis[card.card_rarity]} **${card.card_name}**
📺 Anime: ${card.card_anime}
⭐ Rarity: ${card.card_rarity}
⚡ Power: ${card.card_power}
🌀 Element: ${card.card_element}

💫 Added to your collection!
        `;
        
        if (card.card_image && card.card_image.startsWith('http')) {
          bot.sendPhoto(chatId, card.card_image, { 
            caption: message,
            parse_mode: 'Markdown'
          });
        } else {
          bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }
        
        // Update user stats
        db.run(`UPDATE users SET total_cards = total_cards + 1 WHERE user_id = ?`, [userId]);
      });
    }
  },

  async inventory(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    db.all(`SELECT c.* FROM user_cards uc 
            JOIN cards c ON uc.card_id = c.card_id 
            WHERE uc.user_id = ? ORDER BY c.card_rarity DESC, c.card_power DESC`, 
            [userId], (err, cards) => {
      if (err) {
        bot.sendMessage(chatId, '❌ Error loading inventory!');
        return;
      }
      
      if (cards.length === 0) {
        bot.sendMessage(chatId, '📭 Your inventory is empty!\nUse `/redeem` on card drops to get started!');
        return;
      }
      
      const rarityCount = {
        'Common': 0, 'Rare': 0, 'Epic': 0, 
        'Legendary': 0, 'Mythical': 0
      };
      
      cards.forEach(card => {
        rarityCount[card.card_rarity]++;
      });
      
      let inventoryText = `🎴 **Your Collection** (${cards.length} cards)\n\n`;
      inventoryText += `🟢 Common: ${rarityCount.Common}\n`;
      inventoryText += `🔵 Rare: ${rarityCount.Rare}\n`;
      inventoryText += `🟣 Epic: ${rarityCount.Epic}\n`;
      inventoryText += `🟡 Legendary: ${rarityCount.Legendary}\n`;
      inventoryText += `🔴 Mythical: ${rarityCount.Mythical}\n\n`;
      inventoryText += `💪 Total Power: ${cards.reduce((sum, card) => sum + card.card_power, 0)}\n\n`;
      inventoryText += `Use /cardinfo [id] to view specific cards!`;
      
      bot.sendMessage(chatId, inventoryText, { parse_mode: 'Markdown' });
    });
  },

  async cardinfo(msg, match) {
    const chatId = msg.chat.id;
    const cardId = match[1];
    
    if (!cardId) {
      bot.sendMessage(chatId, '❌ Please provide card ID: `/cardinfo 1`');
      return;
    }
    
    db.get(`SELECT * FROM cards WHERE card_id = ?`, [cardId], (err, card) => {
      if (err || !card) {
        bot.sendMessage(chatId, '❌ Card not found!');
        return;
      }
      
      const rarityEmojis = {
        'Common': '🟢', 'Rare': '🔵', 'Epic': '🟣', 
        'Legendary': '🟡', 'Mythical': '🔴'
      };
      
      const message = `
${rarityEmojis[card.card_rarity]} **${card.card_name}**
📺 Anime: ${card.card_anime}
⭐ Rarity: ${card.card_rarity}
⚡ Power: ${card.card_power}
🌀 Element: ${card.card_element}
🆔 ID: #${card.card_id}
      `;
      
      if (card.card_image && card.card_image.startsWith('http')) {
        bot.sendPhoto(chatId, card.card_image, { 
          caption: message,
          parse_mode: 'Markdown'
        });
      } else {
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }
    });
  },

  // 💰 ECONOMY COMMANDS
  async balance(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    db.get(`SELECT coins, dust FROM users WHERE user_id = ?`, [userId], (err, user) => {
      if (err || !user) {
        bot.sendMessage(chatId, '❌ Please /register first!');
        return;
      }
      
      const message = `
💰 **Your Balance**

🪙 Coins: ${user.coins}
💎 Dust: ${user.dust}

Use /daily to claim free coins!
      `;
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });
  },

  async daily(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const now = new Date();
    
    db.get(`SELECT last_daily, coins FROM users WHERE user_id = ?`, [userId], (err, user) => {
      if (err || !user) {
        bot.sendMessage(chatId, '❌ Please /register first!');
        return;
      }
      
      if (user.last_daily) {
        const lastDaily = new Date(user.last_daily);
        const hoursDiff = (now - lastDaily) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          const hoursLeft = 24 - hoursDiff;
          bot.sendMessage(chatId, 
            `⏰ You can claim daily reward in ${Math.ceil(hoursLeft)} hours!`);
          return;
        }
      }
      
      const dailyCoins = 100 + Math.floor(Math.random() * 50); // 100-150 coins
      db.run(`UPDATE users SET coins = coins + ?, last_daily = ? WHERE user_id = ?`, 
        [dailyCoins, now, userId], function(err) {
        if (err) {
          bot.sendMessage(chatId, '❌ Error claiming daily reward!');
          return;
        }
        
        bot.sendMessage(chatId, 
          `🎉 Daily Reward Claimed!\n🪙 +${dailyCoins} coins!\n\nCome back in 24 hours for more!`);
      });
    });
  },

  async shop(msg) {
    const chatId = msg.chat.id;
    
    const shopItems = `
🛍️ **Card Shop**

📦 **Card Packs:**
1. Starter Pack - 100 coins (3 Common cards)
2. Advanced Pack - 300 coins (2 Rare, 1 Epic)
3. Premium Pack - 500 coins (1 Legendary guaranteed)

🎨 **Cosmetics:**
• Name Color - 200 coins
• Card Frame - 150 coins
• Profile Badge - 300 coins

Use /buy [item] to purchase!
    `;
    
    bot.sendMessage(chatId, shopItems, { parse_mode: 'Markdown' });
  },

  async leaderboard(msg) {
    const chatId = msg.chat.id;
    
    db.all(`SELECT username, total_cards, coins FROM users 
            ORDER BY total_cards DESC, coins DESC LIMIT 10`, (err, users) => {
      if (err) {
        bot.sendMessage(chatId, '❌ Error loading leaderboard!');
        return;
      }
      
      let leaderboardText = `🏆 **Top Collectors**\n\n`;
      
      users.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔸';
        leaderboardText += `${medal} ${user.username || 'Anonymous'}\n`;
        leaderboardText += `   🎴 ${user.total_cards} cards | 🪙 ${user.coins} coins\n\n`;
      });
      
      bot.sendMessage(chatId, leaderboardText, { parse_mode: 'Markdown' });
    });
  },

  // 🛠️ UTILITY COMMANDS
  async help(msg) {
    const chatId = msg.chat.id;
    
    const helpText = `
🎌 **Anime Card Bot - Commands**

🎯 **CARD COMMANDS:**
/register - Start your collection
/redeem [code] - Claim card with code  
/inventory - View your cards
/cardinfo [id] - Show card details
/collection - Card album view
/fuse [id1] [id2] - Combine cards

💰 **ECONOMY:**
/balance - Check coins & dust
/daily - Daily free coins
/weekly - Weekly bonus
/shop - Buy card packs
/leaderboard - Top players

🤝 **TRADING:**
/trade @user [your_card] [their_card]
/auction [card_id] [price]
/marketplace - Browse listings

⚔️ **GAMEPLAY:**
/battle @user - PvP card battle
/quests - Active challenges
/rank - Your battle rank

🏆 **PROFILE:**
/profile - Your stats
/achievements - Your badges
/stats - Collection stats

❓ **Need help?** Contact admin!
    `;
    
    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
  },

  async profile(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    
    db.get(`SELECT * FROM users WHERE user_id = ?`, [userId], (err, user) => {
      if (err || !user) {
        bot.sendMessage(chatId, '❌ Please /register first!');
        return;
      }
      
      db.get(`SELECT COUNT(*) as cardCount FROM user_cards WHERE user_id = ?`, [userId], (err, result) => {
        const cardCount = result ? result.cardCount : 0;
        
        const profileText = `
👤 **Player Profile**

🎮 Username: ${username}
🆔 ID: ${userId}
📅 Registered: ${new Date(user.registered_date).toLocaleDateString()}

🎴 Cards Collected: ${cardCount}
🪙 Coins: ${user.coins}
💎 Dust: ${user.dust}
⚔️ Battle Rank: ${user.battle_rank}

🌟 Keep collecting to rise in ranks!
        `;
        
        bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
      });
    });
  }
};

// Helper functions
async function validateRedeemCode(code) {
  // Implement code validation logic
  // Check if code exists and hasn't been used
  return true; // Placeholder
}

async function getRandomCardForCode(code) {
  // Implement card selection based on code
  return new Promise((resolve) => {
    db.get(`SELECT * FROM cards WHERE card_rarity IN ('Rare', 'Epic', 'Legendary') ORDER BY RANDOM() LIMIT 1`, 
      (err, card) => {
      resolve(card);
    });
  });
}

module.exports = commands;