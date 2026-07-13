const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://mfmmo.com', 'https://www.mfmmo.com'];

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'mfmmoalpha-server', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`mfmmoalpha-server listening on port ${PORT}`);
});
