require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: 'https://depilout.com.br',
}));
app.use(express.json());
app.use(morgan('tiny'));

// Optional rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
});
app.use(limiter);

app.post('/verify-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Token missing' });
  }

  try {
    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: token,
        },
      }
    );

    if (response.data.success && response.data.score > 0.5) {
      return res.json({
        success: true,
        redirectUrl: 'https://sc.com' // Hidden from frontend code
      });
    } else {
      return res.json({ success: false, message: 'CAPTCHA failed' });
    }
  } catch (error) {
    console.error('Verification error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
