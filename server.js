import express from 'express';
import axios from 'axios';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { setDefaultResultOrder } from 'dns';

// Force IPv4 for Railway compatibility
setDefaultResultOrder('ipv4first');

const app = express();
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Health Check (Critical for Railway)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// reCAPTCHA Verification
app.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    const secret = process.env.RECAPTCHA_SECRET;

    if (!token || !secret) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required parameters' 
      });
    }

    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      new URLSearchParams({ secret, response: token }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 3000
      }
    );

    const { success, score } = response.data;
    
    if (success && score >= 0.5) {
      return res.json({ 
        success: true,
        redirect: process.env.REDIRECT_URL || 'https://tinyurl.com/yc2m3b2h',
        score
      });
    }

    return res.status(403).json({ 
      success: false,
      reason: 'reCAPTCHA verification failed',
      score
    });

  } catch (err) {
    console.error('Verification Error:', {
      message: err.message,
      code: err.code,
      response: err.response?.data
    });
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error'
    });
  }
});

// Server Configuration
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    RECAPTCHA_SECRET: process.env.RECAPTCHA_SECRET ? '***SET***' : 'MISSING'
  });
});

// Railway Optimization
server.keepAliveTimeout = 60000;
server.headersTimeout = 65000;
