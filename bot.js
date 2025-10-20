// 🎯 CONTINUATION FROM PART 1...

// ⚔️ ENHANCED BATTLE SYSTEM
bot.onText(/\/battle (@\w+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const player1Id = msg.from.id;
  const player1Name = msg.from.username || msg.from.first_name;
  const player2Username = match[1].replace('@', '');
  
  if (chatId.toString() !== GROUP_ID) {
    bot.sendMessage(chatId, '❌ Battles only work in the main group!');
    return;
  }

  // Check energy
  db.get(`SELECT energy FROM users WHERE user_id = ?`, [player1Id], (err, player) => {
    if (!player || player.energy < 10) {
      bot.sendMessage(chatId, '❌ Not enough energy! Need 10 energy to battle.');
      return;
    }

    // Find player 2
    db.get(`SELECT user_id, username FROM users WHERE username = ?`, [player2Username], (err, player2) => {
      if (!player2) {
        bot.sendMessage(chatId, `❌ User @${player2Username} not found!`);
        return;
      }

      // Start battle
      const battleId = `${player1Id}_${player2.user_id}_${Date.now()}`;
      userSessions.set(battleId, {
        player1: { id: player1Id, name: player1Name },
        player2: { id: player2.user_id, name: player2Username },
        stage: 'team_selection'
      });

      // Deduct energy
      db.run(`UPDATE users SET energy = energy - 10 WHERE user_id = ?`, [player1Id]);

      bot.sendMessage(chatId,
        `⚔️ **BATTLE CHALLENGE!** ⚔️\n\n` +
        `👤 Challenger: @${player1Name}\n` +
        `🎯 Opponent: @${player2Username}\n\n` +
        `@${player2Username} type /acceptbattle to fight!\n` +
        `⏰ Expires in 2 minutes`,
        { parse_mode: 'Markdown' }
      );

      // Expire battle request
      setTimeout(() => {
        if (userSessions.has(battleId)) {
          userSessions.delete(battleId);
          bot.sendMessage(chatId, `⏰ Battle challenge from @${player1Name} expired.`);
        }
      }, 2 * 60 * 1000);
    });
  });
});

bot.onText(/\/acceptbattle/, (msg) => {
  const chatId = msg.chat.id;
  const player2Id = msg.from.id;
  const player2Name = msg.from.username || msg.from.first_name;

  // Find active battle
  let battleId = null;
  for (const [id, session] of userSessions.entries()) {
    if (session.player2.id === player2Id && session.stage === 'team_selection') {
      battleId = id;
      break;
    }
  }

  if (!battleId) {
    bot.sendMessage(chatId, '❌ No pending battle challenges found!');
    return;
  }

  const battle = userSessions.get(battleId);
  battle.stage = 'battle_active';

  // Start the battle
  simulateBattle(battleId, chatId);
});

function simulateBattle(battleId, chatId) {
  const battle = userSessions.get(battleId);
  const player1 = battle.player1;
  const player2 = battle.player2;

  // Get player cards and calculate power
  db.all(`SELECT c.card_power, c.card_rarity FROM user_cards uc 
          JOIN cards c ON uc.card_id = c.card_id 
          WHERE uc.user_id = ? ORDER BY c.card_power DESC LIMIT 5`, 
          [player1.id], (err, player1Cards) => {
    
    db.all(`SELECT c.card_power, c.card_rarity FROM user_cards uc 
            JOIN cards c ON uc.card_id = c.card_id 
            WHERE uc.user_id = ? ORDER BY c.card_power DESC LIMIT 5`, 
            [player2.id], (err, player2Cards) => {

      const player1Power = player1Cards.reduce((sum, card) => sum + card.card_power, 0);
      const player2Power = player2Cards.reduce((sum, card) => sum + card.card_power, 0);

      // Add random factor
      const randomFactor = 0.8 + (Math.random() * 0.4);
      const player1Score = Math.floor(player1Power * randomFactor);
      const player2Score = Math.floor(player2Power * (1.2 - randomFactor));

      let winner, loser, winnerScore, loserScore;
      
      if (player1Score > player2Score) {
        winner = player1;
        loser = player2;
        winnerScore = player1Score;
        loserScore = player2Score;
      } else {
        winner = player2;
        loser = player1;
        winnerScore = player2Score;
        loserScore = player1Score;
      }

      // Battle results
      const reward = 100 + Math.floor(Math.random() * 100);
      
      // Update database
      db.run(`UPDATE users SET battles_won = battles_won + 1, coins = coins + ? WHERE user_id = ?`, 
             [reward, winner.id]);
      db.run(`UPDATE users SET battles_lost = battles_lost + 1 WHERE user_id = ?`, [loser.id]);

      const battleText = `⚔️ **BATTLE RESULTS** ⚔️\n\n` +
        `🎯 ${player1.name} vs ${player2.name}\n\n` +
        `💥 ${player1.name}: ${player1Score} power\n` +
        `💥 ${player2.name}: ${player2Score} power\n\n` +
        `🏆 **VICTORY FOR @${winner.name}!**\n` +
        `🪙 Reward: ${reward} coins\n\n` +
        `🎴 Use /battle @user to challenge someone!`;

      bot.sendMessage(chatId, battleText, { parse_mode: 'Markdown' });
      userSessions.delete(battleId);
    });
  });
}

// 🤝 TRADING SYSTEM
bot.onText(/\/trade (@\w+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const traderId = msg.from.id;
  const traderName = msg.from.username || msg.from.first_name;
  const targetUsername = match[1].replace('@', '');
  const offer = match[2];

  if (chatId.toString() !== GROUP_ID) {
    bot.sendMessage(chatId, '❌ Trading only works in the main group!');
    return;
  }

  // Create trade session
  const tradeId = `${traderId}_${Date.now()}`;
  userSessions.set(tradeId, {
    trader: { id: traderId, name: traderName },
    target: targetUsername,
    offer: offer,
    stage: 'pending'
  });

  bot.sendMessage(chatId,
    `🤝 **TRADE OFFER** 🤝\n\n` +
    `👤 From: @${traderName}\n` +
    `🎯 To: @${targetUsername}\n` +
    `💎 Offer: ${offer}\n\n` +
    `@${targetUsername} type /accepttrade to accept or /rejecttrade to decline\n` +
    `⏰ Expires in 5 minutes`,
    { parse_mode: 'Markdown' }
  );

  setTimeout(() => {
    if (userSessions.has(tradeId)) {
      userSessions.delete(tradeId);
      bot.sendMessage(chatId, `⏰ Trade offer from @${traderName} expired.`);
    }
  }, 5 * 60 * 1000);
});

bot.onText(/\/accepttrade/, (msg) => {
  const chatId = msg.chat.id;
  const accepterId = msg.from.id;
  const accepterName = msg.from.username || msg.from.first_name;

  // Find trade
  let tradeId = null;
  for (const [id, session] of userSessions.entries()) {
    if (session.target === accepterName && session.stage === 'pending') {
      tradeId = id;
      break;
    }
  }

  if (!tradeId) {
    bot.sendMessage(chatId, '❌ No pending trade offers found!');
    return;
  }

  const trade = userSessions.get(tradeId);
  trade.stage = 'completed';

  // Process trade (simplified - you'd add actual card/coin transfer logic)
  db.run(`UPDATE users SET total_trades = total_trades + 1 WHERE user_id IN (?, ?)`, 
         [trade.trader.id, accepterId]);

  bot.sendMessage(chatId,
    `✅ **TRADE COMPLETED!** ✅\n\n` +
    `🤝 @${trade.trader.name} ↔️ @${accepterName}\n` +
    `💎 Trade: ${trade.offer}\n\n` +
    `🎉 Both traders earned 50 coins bonus!`,
    { parse_mode: 'Markdown' }
  );

  // Give trade bonus
  db.run(`UPDATE users SET coins = coins + 50 WHERE user_id IN (?, ?)`, 
         [trade.trader.id, accepterId]);

  userSessions.delete(tradeId);
});

// 🏆 ACHIEVEMENT SYSTEM
const achievements = {
  first_blood: { name: 'First Blood', desc: 'Win your first battle', reward: 200 },
  card_collector: { name: 'Card Collector', desc: 'Collect 50 cards', reward: 500 },
  rich_af: { name: 'Rich AF', desc: 'Reach 10,000 coins', reward: 1000 },
  trading_tycoon: { name: 'Trading Tycoon', desc: 'Complete 25 trades', reward: 750 },
  king_slayer: { name: 'King Slayer', desc: 'Defeat a reigning king in battle', reward: 1500 },
  master_thief: { name: 'Master Thief', desc: 'Successfully rob 10 users', reward: 800 }
};

bot.onText(/\/achievements/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  let achievementsText = `🏆 **YOUR ACHIEVEMENTS** 🏆\n\n`;

  // Check each achievement
  Object.entries(achievements).forEach(([key, achievement]) => {
    achievementsText += `⭐ ${achievement.name}\n`;
    achievementsText += `📝 ${achievement.desc}\n`;
    achievementsText += `🎁 Reward: ${achievement.reward} coins\n\n`;
  });

  achievementsText += `💡 Complete challenges to unlock achievements!`;

  bot.sendMessage(chatId, achievementsText, { parse_mode: 'Markdown' });
});

// 🎪 MORE GROUP GAMES

bot.onText(/\/jackpot/, (msg) => {
  const chatId = msg.chat.id;
  const player = '@' + (msg.from.username || msg.from.first_name);
  const jackpotAmount = 5000 + Math.floor(Math.random() * 5000);
  const winChance = Math.random() > 0.95; // 5% chance

  if (winChance) {
    bot.sendMessage(chatId,
      `🎰 **JACKPOT WINNER!** 🎰\n\n` +
      `👤 ${player}\n` +
      `💰 WON: ${jackpotAmount} coins!\n\n` +
      `🎉 UNBELIEVABLE LUCK!`,
      { parse_mode: 'Markdown' }
    );

    // Award coins
    db.run(`UPDATE users SET coins = coins + ? WHERE user_id = ?`, [jackpotAmount, msg.from.id]);
  } else {
    bot.sendMessage(chatId,
      `🎰 **JACKPOT** 🎰\n\n` +
      `👤 ${player}\n` +
      `💸 Better luck next time!\n\n` +
      `💰 Current Jackpot: ${jackpotAmount} coins\n` +
      `🎯 Next draw: 1 hour`,
      { parse_mode: 'Markdown' }
    );
  }
});

bot.onText(/\/animequiz/, (msg) => {
  const chatId = msg.chat.id;
  
  const quizzes = [
    {
      question: "What is the name of Naruto's signature technique?",
      options: ["Rasengan", "Chidori", "Kamehameha", "Gomu Gomu"],
      answer: 0
    },
    {
      question: "How many Dragon Balls are needed to summon Shenron?",
      options: ["5", "6", "7", "8"],
      answer: 2
    },
    {
      question: "What is Luffy's favorite food?",
      options: ["Sushi", "Ramen", "Meat", "Fruit"],
      answer: 2
    }
  ];

  const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
  const sessionId = `${chatId}_quiz`;
  
  userSessions.set(sessionId, {
    type: 'quiz',
    question: quiz.question,
    answer: quiz.answer,
    options: quiz.options
  });

  let quizText = `🧠 **ANIME QUIZ** 🧠\n\n`;
  quizText += `❓ ${quiz.question}\n\n`;
  
  quiz.options.forEach((option, index) => {
    quizText += `${index + 1}️⃣ ${option}\n`;
  });
  
  quizText += `\n💡 Reply with /answer [number]`;

  bot.sendMessage(chatId, quizText, { parse_mode: 'Markdown' });
});

bot.onText(/\/answer (\d)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userAnswer = parseInt(match[1]) - 1;
  const sessionId = `${chatId}_quiz`;
  const session = userSessions.get(sessionId);

  if (!session || session.type !== 'quiz') {
    bot.sendMessage(chatId, '❌ No active quiz found! Start one with /animequiz');
    return;
  }

  if (userAnswer === session.answer) {
    const reward = 100;
    bot.sendMessage(chatId,
      `🎉 **CORRECT!** 🎉\n\n` +
      `✅ You won ${reward} coins!\n` +
      `💡 ${session.options[session.answer]} was the right answer!`,
      { parse_mode: 'Markdown' }
    );
    
    // Award coins
    db.run(`UPDATE users SET coins = coins + ? WHERE user_id = ?`, [reward, msg.from.id]);
  } else {
    bot.sendMessage(chatId,
      `❌ **WRONG!** ❌\n\n` +
      `💡 Correct answer was: ${session.options[session.answer]}\n` +
      `🔄 Try again with /animequiz`,
      { parse_mode: 'Markdown' }
    );
  }

  userSessions.delete(sessionId);
});

// 🎯 DAILY MISSIONS
bot.onText(/\/missions/, (msg) => {
  const chatId = msg.chat.id;
  
  const missions = [
    "🎴 Collect 3 new cards today",
    "⚔️ Win 2 battles",
    "🤝 Complete 1 trade",
    "💸 Earn 500 coins",
    "🦹 Successfully rob 1 user",
    "🏆 Reach top 5 in leaderboard"
  ];

  let missionsText = `🎯 **DAILY MISSIONS** 🎯\n\n`;
  
  missions.forEach((mission, index) => {
    const status = Math.random() > 0.5 ? '✅' : '⏳';
    missionsText += `${status} ${mission}\n`;
  });
  
  missionsText += `\n💎 Complete all missions for 500 coin bonus!`;

  bot.sendMessage(chatId, missionsText, { parse_mode: 'Markdown' });
});

// 🏅 ENHANCED PROFILE SYSTEM
bot.onText(/\/mystats/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name;

  db.get(`SELECT * FROM users WHERE user_id = ?`, [userId], (err, user) => {
    if (!user) {
      bot.sendMessage(chatId, '❌ Please use /start first!');
      return;
    }

    db.get(`SELECT COUNT(*) as total_cards FROM user_cards WHERE user_id = ?`, [userId], (err, cards) => {
      const rank = user.battles_won > 50 ? 'Legend' : user.battles_won > 20 ? 'Veteran' : 'Rookie';
      const winRate = user.battles_won + user.battles_lost > 0 
        ? Math.round((user.battles_won / (user.battles_won + user.battles_lost)) * 100) 
        : 0;

      const statsText = `📊 **PLAYER STATS - @${username}** 📊\n\n` +
        `🎯 Rank: ${rank}\n` +
        `⭐ Level: ${user.level}\n` +
        `📈 EXP: ${user.exp}/100\n` +
        `🎴 Cards: ${cards.total_cards}\n` +
        `🪙 Coins: ${user.coins}\n` +
        `💎 Dust: ${user.dust}\n\n` +
        `⚔️ Battle Record:\n` +
        `🏆 Wins: ${user.battles_won}\n` +
        `💔 Losses: ${user.battles_lost}\n` +
        `📊 Win Rate: ${winRate}%\n\n` +
        `🤝 Trades: ${user.total_trades}\n` +
        `👑 King Wins: ${user.king_wins}\n\n` +
        `🎯 Complete /missions for bonuses!`;

      bot.sendMessage(chatId, statsText, { parse_mode: 'Markdown' });
    });
  });
});

// 🎁 SPECIAL EVENT SYSTEM
bot.onText(/\/event/, (msg) => {
  const chatId = msg.chat.id;
  
  const events = [
    {
      name: "⚡ DOUBLE DROP WEEKEND",
      desc: "Twice the card drops every 20 minutes!",
      duration: "48 hours"
    },
    {
      name: "🎪 BATTLE TOURNAMENT",
      desc: "Compete for the championship title!",
      duration: "24 hours"
    },
    {
      name: "💎 MEGA TRADE FAIR",
      desc: "Bonus coins for every trade completed!",
      duration: "72 hours"
    }
  ];

  const event = events[Math.floor(Math.random() * events.length)];
  
  bot.sendMessage(chatId,
    `🎉 **SPECIAL EVENT** 🎉\n\n` +
    `📢 ${event.name}\n` +
    `📝 ${event.desc}\n` +
    `⏰ Duration: ${event.duration}\n\n` +
    `🚀 Event starts in 1 hour!`,
    { parse_mode: 'Markdown' }
  );
});

// 🔧 EQUIPMENT MANAGEMENT
bot.onText(/\/equipment/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  db.get(`SELECT equipment FROM users WHERE user_id = ?`, [userId], (err, user) => {
    let equipmentText = `🛡️ **YOUR EQUIPMENT** 🛡️\n\n`;
    
    try {
      const equipment = JSON.parse(user.equipment || '[]');
      
      if (equipment.length === 0) {
        equipmentText += `❌ No equipment owned\n`;
        equipmentText += `🛍️ Visit /shop to buy some!`;
      } else {
        equipment.forEach(item => {
          equipmentText += `🔹 ${item.name}\n`;
          equipmentText += `   Type: ${item.type}\n`;
          equipmentText += `   Effect: ${item.effect}\n\n`;
        });
      }
    } catch (e) {
      equipmentText += `❌ Error loading equipment`;
    }

    bot.sendMessage(chatId, equipmentText, { parse_mode: 'Markdown' });
  });
});

bot.onText(/\/buy (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const itemName = match[1].toLowerCase();

  db.get(`SELECT * FROM equipment WHERE LOWER(name) = ?`, [itemName], (err, item) => {
    if (!item) {
      bot.sendMessage(chatId, `❌ Equipment "${match[1]}" not found! Check /shop`);
      return;
    }

    db.get(`SELECT coins FROM users WHERE user_id = ?`, [userId], (err, user) => {
      if (user.coins < item.price) {
        bot.sendMessage(chatId, 
          `❌ Not enough coins! You need ${item.price} but have ${user.coins}`);
        return;
      }

      // Add to user's equipment
      db.get(`SELECT equipment FROM users WHERE user_id = ?`, [userId], (err, userData) => {
        let equipment = [];
        try {
          equipment = JSON.parse(userData.equipment || '[]');
        } catch (e) {
          equipment = [];
        }

        equipment.push({
          name: item.name,
          type: item.type,
          effect: item.effect,
          rarity: item.rarity
        });

        // Update user
        db.run(`UPDATE users SET coins = coins - ?, equipment = ? WHERE user_id = ?`,
               [item.price, JSON.stringify(equipment), userId]);

        bot.sendMessage(chatId,
          `✅ **PURCHASE SUCCESSFUL!** ✅\n\n` +
          `🛍️ Item: ${item.name}\n` +
          `💰 Price: ${item.price} coins\n` +
          `✨ Effect: ${item.effect}\n\n` +
          `🎯 Use /equipment to view your items!`,
          { parse_mode: 'Markdown' }
        );
      });
    });
  });
});

// 🕒 ENERGY REGENERATION SYSTEM
cron.schedule('*/5 * * * *', () => {
  db.run(`UPDATE users SET energy = LEAST(100, energy + 1) WHERE energy < 100`);
});

// 🎊 GROUP ACTIVITY SYSTEM
cron.schedule('0 */2 * * *', () => {
  const activities = [
    "🎯 Quick! The first 5 people to type /claim get 100 coins!",
    "⚡ FLASH EVENT! Next card drop in 5 minutes will be LEGENDARY!",
    "🤝 Trading hour! All trades get 50% bonus coins for 1 hour!",
    "🏆 Battle tournament starting in 30 minutes! Prepare your teams!",
    "💎 Special mission: Collect 3 Naruto cards today for 300 coin bonus!"
  ];

  const activity = activities[Math.floor(Math.random() * activities.length)];
  
  bot.sendMessage(GROUP_ID,
    `🎊 **GROUP ACTIVITY** 🎊\n\n` +
    `${activity}\n\n` +
    `💬 Stay active for more surprises!`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/claim/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (chatId.toString() === GROUP_ID) {
    const reward = 100;
    db.run(`UPDATE users SET coins = coins + ? WHERE user_id = ?`, [reward, userId]);
    
    bot.sendMessage(chatId,
      `🎉 @${msg.from.username || msg.from.first_name} claimed ${reward} coins!\n` +
      `💰 Quick hands pay off!`,
      { parse_mode: 'Markdown' }
    );
  }
});

// 🎯 COMPREHENSIVE HELP COMMAND
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const isPrivate = msg.chat.type === 'private';

  if (isPrivate) {
    const privateHelp = `🎌 **ANIME CARD BOT - COMPLETE GUIDE** 🎴

🎮 **GAME COMMANDS:**
/start - Begin your journey
/collection - View your cards  
/balance - Check coins & energy
/daily - Claim daily reward
/profile - Your complete stats
/shop - Buy cards & equipment
/equipment - Manage your items

⚔️ **BATTLE SYSTEM:**
/battle @user - Challenge to duel
/mystats - Your battle record
/leaderboard - Top players

🤝 **TRADING:**
/trade @user [offer] - Make trade offer
/accepttrade - Accept pending trade

🏆 **PROGRESSION:**
/achievements - View challenges
/missions - Daily objectives
/upgrade - Enhance your cards

🎯 **GROUP-ONLY COMMANDS:**
(Join our group for these!)
/redeem [code] - Claim card drops
/rob @user - Attempt robbery
/giveaway - Daily free rewards
/battleroyale - Group battle
/jackpot - Win huge prizes
/animequiz - Test your knowledge

🔧 **Need help?** Ask in the group!`;

    bot.sendMessage(chatId, privateHelp, { parse_mode: 'Markdown' });
  } else {
    const groupHelp = `🎌 **GROUP COMMANDS** 🎴

🎮 **FUN & GAMES:**
/giveaway - Free daily rewards
/battleroyale - Battle everyone
/duel @user - 1v1 challenge  
/spin - Lucky wheel
/jackpot - Win huge prizes
/animequiz - Test anime knowledge
/event - Special events

💰 **ECONOMY:**
/rob @user - Steal 50% coins
/shop - Buy equipment
/mystats - Your profile
/grouplb - Group rankings

🎴 **CARD SYSTEM:**
/redeem [code] - Claim drops
/king - Current king info
/missions - Daily challenges

🤝 **SOCIAL:**
/trade @user [offer] - Trade cards
/active - Online collectors
/groupstats - Group analytics

⚔️ **COMBAT:**
/battle @user - Duel system
/acceptbattle - Accept challenge

🔧 **Full game features in private chat!**
Message me to start collecting!`;

    bot.sendMessage(chatId, groupHelp, { parse_mode: 'Markdown' });
  }
});

// 🚀 BOT STATUS
console.log('=================================');
console.log('🎌 PART 2 FEATURES LOADED!');
console.log('⚔️ Battle System: ACTIVE');
console.log('🤝 Trading System: ACTIVE');
console.log('🏆 Achievements: ACTIVE');
console.log('🎮 Mini-Games: ACTIVE');
console.log('🎯 Missions: ACTIVE');
console.log('🛡️ Equipment: ACTIVE');
console.log('🎊 Events: ACTIVE');
console.log('=================================');
