const sqlite3 = require('sqlite3').verbose();

function initializeCards(db) {
  const animeCards = [
    // NARUTO CARDS
    ['Naruto Uzumaki (Genin)', 'Naruto', 'Common', '', 45, 'Wind'],
    ['Sasuke Uchiha (Academy)', 'Naruto', 'Common', '', 48, 'Fire'],
    ['Sakura Haruno', 'Naruto', 'Common', '', 40, 'Medical'],
    ['Kakashi Hatake', 'Naruto', 'Rare', '', 120, 'Lightning'],
    ['Naruto (Rasengan)', 'Naruto', 'Rare', '', 130, 'Wind'],
    ['Sasuke (Chidori)', 'Naruto', 'Rare', '', 125, 'Lightning'],
    ['Itachi Uchiha', 'Naruto', 'Epic', '', 380, 'Sharingan'],
    ['Pain (Nagato)', 'Naruto', 'Epic', '', 400, 'Rinnegan'],
    ['Naruto (Six Paths)', 'Naruto', 'Legendary', '', 950, 'Six Paths'],
    ['Madara Uchiha', 'Naruto', 'Legendary', '', 920, 'Rinnegan'],
    
    // ONE PIECE CARDS
    ['Monkey D. Luffy (East Blue)', 'One Piece', 'Common', '', 50, 'Rubber'],
    ['Roronoa Zoro (Pre-Timeskip)', 'One Piece', 'Common', '', 55, 'Swordsman'],
    ['Nami (Early)', 'One Piece', 'Common', '', 35, 'Weather'],
    ['Sanji (Baratie)', 'One Piece', 'Rare', '', 110, 'Fire'],
    ['Usopp (Sogeking)', 'One Piece', 'Rare', '', 95, 'Sniper'],
    ['Portgas D. Ace', 'One Piece', 'Epic', '', 320, 'Flame'],
    ['Trafalgar Law', 'One Piece', 'Epic', '', 350, 'Op-Op Fruit'],
    ['Luffy (Gear Fourth)', 'One Piece', 'Legendary', '', 720, 'Rubber'],
    ['Luffy (Gear 5)', 'One Piece', 'Legendary', '', 980, 'Sun God'],
    ['Gol D. Roger', 'One Piece', 'Mythical', '', 1500, 'Conqueror'],
    
    // DRAGON BALL CARDS
    ['Goku (Kid)', 'Dragon Ball', 'Common', '', 40, 'Martial Arts'],
    ['Vegeta (Saiyan Saga)', 'Dragon Ball', 'Rare', '', 140, 'Galick Gun'],
    ['Goku (Super Saiyan)', 'Dragon Ball', 'Epic', '', 420, 'Super Saiyan'],
    ['Vegeta (Super Saiyan)', 'Dragon Ball', 'Epic', '', 410, 'Super Saiyan'],
    ['Goku (Ultra Instinct)', 'Dragon Ball', 'Legendary', '', 1000, 'Ultra Instinct'],
    ['Whis', 'Dragon Ball', 'Mythical', '', 1600, 'Angel'],
    
    // JUJUTSU KAISEN CARDS
    ['Yuji Itadori', 'Jujutsu Kaisen', 'Common', '', 50, 'Cursed Energy'],
    ['Megumi Fushiguro', 'Jujutsu Kaisen', 'Rare', '', 140, 'Ten Shadows'],
    ['Gojo Satoru', 'Jujutsu Kaisen', 'Epic', '', 480, 'Limitless'],
    ['Sukuna', 'Jujutsu Kaisen', 'Legendary', '', 900, 'Cursed Energy'],
    
    // DEMON SLAYER CARDS
    ['Tanjiro Kamado', 'Demon Slayer', 'Common', '', 55, 'Water Breathing'],
    ['Nezuko Kamado', 'Demon Slayer', 'Rare', '', 145, 'Blood Demon Art'],
    ['Kyojuro Rengoku', 'Demon Slayer', 'Epic', '', 470, 'Flame Breathing'],
    ['Muzan Kibutsuji', 'Demon Slayer', 'Legendary', '', 880, 'Blood Demon Art'],
    
    // ATTACK ON TITAN CARDS
    ['Eren Yeager (Cadet)', 'Attack on Titan', 'Common', '', 45, 'Determination'],
    ['Mikasa Ackerman', 'Attack on Titan', 'Common', '', 55, 'Ackerman'],
    ['Levi Ackerman', 'Attack on Titan', 'Rare', '', 160, 'Ackerman'],
    ['Eren (Attack Titan)', 'Attack on Titan', 'Epic', '', 380, 'Titan Shifter'],
    
    // SOLO LEVELING CARDS
    ['Sung Jin-Woo (E-Rank)', 'Solo Leveling', 'Common', '', 40, 'Hunter'],
    ['Igris', 'Solo Leveling', 'Rare', '', 135, 'Shadow'],
    ['Sung Jin-Woo (Shadow Monarch)', 'Solo Leveling', 'Epic', '', 450, 'Shadow'],
    ['Ashborn', 'Solo Leveling', 'Legendary', '', 1550, 'Absolute Shadow'],
    
    // OTHER ANIME CARDS
    ['Izuku Midoriya (U.A.)', 'My Hero Academia', 'Common', '', 60, 'One For All'],
    ['Katsuki Bakugo', 'My Hero Academia', 'Rare', '', 150, 'Explosion'],
    ['All Might', 'My Hero Academia', 'Epic', '', 480, 'One For All'],
    ['Takemichi Hanagaki', 'Tokyo Revengers', 'Common', '', 45, 'Time Leaper'],
    ['Mikey', 'Tokyo Revengers', 'Rare', '', 155, 'Martial Arts'],
    ['Denji', 'Chainsaw Man', 'Common', '', 65, 'Chainsaw Devil'],
    ['Makima', 'Chainsaw Man', 'Epic', '', 520, 'Control Devil']
  ];
  
  const insertStmt = db.prepare(`INSERT OR IGNORE INTO cards 
    (card_name, card_anime, card_rarity, card_image, card_power, card_element) 
    VALUES (?, ?, ?, ?, ?, ?)`);
  
  animeCards.forEach(card => {
    insertStmt.run(card);
  });
  
  insertStmt.finalize();
  console.log('🎴 50+ sample anime cards initialized!');
}

module.exports = { initializeCards };