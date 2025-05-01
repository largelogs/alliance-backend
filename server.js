import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

// Force IPv4 to prevent Railway IPv6 issues
import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

dotenv.config();
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// reCAPTCHA Verification Endpoint
app.post('/verify-token', async (req, res) => {
  const { token } = req.body;
  const secret = process.env.RECAPTCHA_SECRET;

  if (!token || !secret) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing token or server configuration' 
    });
  }

  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      new URLSearchParams({ secret, response: token }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 3000
      }
    );

    const { success, score, action } = response.data;
    
    if (success && score >= 0.5) {
      return res.json({ 
        success: true,
        redirect: process.env.REDIRECT_URL || 'https://tinyurl.com/yc2m3b2h',
        score,
        action
      });
    }

    return res.status(403).json({ 
      success: false,
      reason: 'Failed reCAPTCHA verification',
      score
    });

  } catch (err) {
    console.error('reCAPTCHA Error:', {
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

// Health Check (Required for Railway)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Server Setup
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// Railway Optimization
server.keepAliveTimeout = 60000;
server.headersTimeout = 65000;
