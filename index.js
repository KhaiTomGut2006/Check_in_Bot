require('dotenv').config();
const mongoose = require('mongoose');
const { client } = require('./bot/bot');
const { app } = require('./api/server');
const { loadConfig } = require('./utils/configLoader');


mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    await loadConfig();

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`🌍 Web API running on port ${PORT}`);
    });

    client.login(process.env.DISCORD_TOKEN);
  })
  .catch(err => console.error('❌ Init Error:', err));