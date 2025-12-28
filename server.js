const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Load API routes dynamically
const apiPath = path.join(__dirname, 'api');
if (fs.existsSync(apiPath)) {
  fs.readdirSync(apiPath).forEach(file => {
    if (file.endsWith('.js')) {
      const routeName = file.replace('.js', '');
      const routePath = path.join(apiPath, file);

      try {
        const routeHandler = require(routePath);
        app.all(`/api/${routeName}`, async (req, res) => {
          try {
            console.log(`📡 ${req.method} /api/${routeName}`);
            await routeHandler(req, res);
          } catch (error) {
            console.error(`❌ Error in /api/${routeName}:`, error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });
        console.log(`✅ Loaded API route: /api/${routeName}`);
      } catch (error) {
        console.error(`❌ Error loading ${file}:`, error);
      }
    }
  });
}

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin.html for /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📁 Static files served from: ${path.join(__dirname, 'public')}`);
  console.log(`🔌 API routes available at: http://localhost:${PORT}/api/*`);
});
