// city-country-service/index.js
// Express micro-service for country/city filtering

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
const firebaseConfig = require('../firebaseConfig.node.cjs');

const app = express();
app.use(cors());
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// Get all countries
app.get('/countries', async (req, res) => {
  try {
    const snap = await get(ref(db, 'referenceCountries'));
    if (!snap.exists()) return res.json([]);
    const countries = Object.values(snap.val()).map(c => c.name);
    res.json(countries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get cities filtered by country
app.get('/cities', async (req, res) => {
  const { country } = req.query;
  try {
    const snap = await get(ref(db, 'referenceCities'));
    if (!snap.exists()) return res.json([]);
    let cities = Object.values(snap.val());
    if (country) {
      cities = cities.filter(city => city.country === country || (!city.country && country === 'Germany'));
    }
    res.json(cities.map(city => city.name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`City-Country service running on port ${PORT}`);
});
