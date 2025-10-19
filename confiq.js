module.exports = {
  // Bot Information
  bot: {
    name: "Anime Card Collector",
    creator: "Zenon",
    version: "1.0.0",
    token: "8461726439:AAFRf0lB1QK9m0POjlwaJA0eV6nkW-Zjqjo"
  },
  
  // Admin Configuration
  admins: [6094186912],
  groupId: "-1003149343469",
  
  // Game Economy
  economy: {
    starterCoins: 500,
    dailyMin: 100,
    dailyMax: 150,
    weeklyBonus: 500,
    battleReward: 50,
    tradeFee: 0.05
  },
  
  // Card System
  cards: {
    dropInterval: 25, // minutes
    codeExpiry: 5, // minutes
    maxInventory: 100,
    rarities: {
      common: { weight: 60, emoji: '🟢' },
      rare: { weight: 25, emoji: '🔵' },
      epic: { weight: 10, emoji: '🟣' },
      legendary: { weight: 4, emoji: '🟡' },
      mythical: { weight: 1, emoji: '🔴' }
    }
  },
  
  // Battle System
  battle: {
    energyCost: 10,
    energyRegen: 1, // per 5 minutes
    maxEnergy: 100,
    winReward: 50,
    loseReward: 10
  },
  
  // Moderation
  moderation: {
    banDuration: 10, // minutes
    maxWarnings: 3,
    warningExpiry: 7 // days
  },
  
  // Anime Series
  animeSeries: [
    'Naruto',
    'One Piece',
    'Dragon Ball',
    'Jujutsu Kaisen',
    'Demon Slayer',
    'Attack on Titan',
    'Solo Leveling',
    'My Hero Academia',
    'Tokyo Revengers',
    'Chainsaw Man'
  ]
};