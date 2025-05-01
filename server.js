import express from 'express';
import axios from 'axios';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { setDefaultResultOrder } from 'dns';

// Force IPv4 for Railway compatibility
setDefaultResultOrder('ipv4first');

// Config
const app = express();
app.set('trust proxy', 1); // Trust Railway's proxy
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // Critical for Railway

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate Limiting (100 requests/minute)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Health Check (Required for Railway)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    redirectUrl: process.env.REDIRECT_URL || 'default_not_set'
  });
});

// reCAPTCHA Verification Endpoint
app.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    const secret = process.env.RECAPTCHA_SECRET;

    // Validate input
    if (!token || !secret) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing token or server configuration' 
      });
    }

    // Verify with Google
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      new URLSearchParams({ secret, response: token }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 3000 // 3-second timeout
      }
    );

    const { success, score } = response.data;
    
    // Successful verification
    if (success && score >= 0.5) {
      return res.json({ 
        success: true,
        redirect: process.env.REDIRECT_URL || 'https://default-fallback-url.com',
        score
      });
    }

    // Failed verification
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

// Start Server
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log('Active Configuration:', {
    nodeEnv: process.env.NODE_ENV,
    redirectUrl: process.env.REDIRECT_URL || 'default_not_set',
    recaptchaReady: !!process.env.RECAPTCHA_SECRET
  });
});

// Railway Optimization
server.keepAliveTimeout = 60000; // 60s
server.headersTimeout = 65000; // 65s

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
