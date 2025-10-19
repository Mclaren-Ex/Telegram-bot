// Health check endpoint for Render
const http = require('http');
const db = require('sqlite3').verbose().Database('./anime_cards.db');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    // Check database connection
    db.get('SELECT 1 as test', (err, row) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ERROR',
          timestamp: new Date().toISOString(),
          service: 'Anime Card Bot',
          error: 'Database connection failed'
        }));
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Anime Card Bot by Zenon',
        version: '1.0.0',
        database: 'Connected'
      }));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🩺 Health check server running on port ${PORT}`);
});

module.exports = server;