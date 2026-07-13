const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Update this to your actual Vercel domain once it's live.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'mfmmoalpha-server', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`mfmmoalpha-server listening on port ${PORT}`);
});
