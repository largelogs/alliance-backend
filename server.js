const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
});
app.use(limiter);

// Routes
app.post('/verify-token', async (req, res) => {
  const token = req.body.token;
  const secret = process.env.SECRET_KEY;
  const redirectUrl = 'https://tinyurl.com/yc2m3b2h';

  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      { params: { secret, response: token } }
    );
    const data = response.data;

    if (data.success && data.score > 0.5) {
      res.json({ success: true, redirect: redirectUrl });
    } else {
      res.status(403).json({ success: false });
    }
  } catch (err) {
    console.error('Verification error:', err.message);
    res.status(500).json({ success: false });
  }
});

// Default Route
app.get('/', (req, res) => {
  res.send('Backend running');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
