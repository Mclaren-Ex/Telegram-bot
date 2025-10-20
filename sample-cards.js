const sqlite3 = require('sqlite3').verbose();

function initializeCards(db) {
  const sampleCards = [
    ['Naruto Uzumaki', 'Naruto', 'Common', 50, 'Wind'],
    ['Sasuke Uchiha', 'Naruto', 'Common', 55, 'Fire'],
    ['Luffy', 'One Piece', 'Common', 60, 'Rubber'],
    ['Goku', 'Dragon Ball', 'Common', 65, 'Martial Arts'],
    ['Gojo Satoru', 'Jujutsu Kaisen', 'Epic', 480, 'Limitless']
  ];

  const statement = db.prepare(`INSERT OR IGNORE INTO cards 
    (card_name, card_anime, card_rarity, card_power, card_element) 
    VALUES (?, ?, ?, ?, ?)`);
  
  sampleCards.forEach(card => {
    statement.run(card);
  });
  
  statement.finalize();
  console.log('✅ Sample cards initialized');
}

module.exports = { initializeCards };
