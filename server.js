import express from 'express';
import axios from 'axios';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { setDefaultResultOrder } from 'dns';

// =====================
// CONFIGURATION
// =====================
setDefaultResultOrder('ipv4first');
const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// =====================
// MIDDLEWARE
// =====================
app.set('trust proxy', 1);
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting (100 requests/minute)
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
}));

// =====================
// ROUTES
// =====================

// Health Check (Required for Railway)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    redirectUrl: process.env.REDIRECT_URL || 'not_set'
  });
});

// reCAPTCHA Verification Endpoint
app.post('/verify-token', async (req, res) => {
  const { token } = req.body;
  const secret = process.env.RECAPTCHA_SECRET;

  // Input validation
  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Missing reCAPTCHA token'
    });
  }

  if (!secret) {
    console.error('ERROR: RECAPTCHA_SECRET environment variable not set');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error'
    });
  }

  try {
    // Verify with Google
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      new URLSearchParams({ secret, response: token }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 3000
      }
    );

    const { success, score, 'error-codes': errorCodes = [] } = response.data;

    // Debug logging
    console.log('reCAPTCHA Verification Result:', {
      success,
      score,
      errors: errorCodes,
      timestamp: new Date().toISOString()
    });

    if (!success) {
      return res.status(403).json({
        success: false,
        reason: 'reCAPTCHA verification failed',
        errors: errorCodes,
        score
      });
    }

    if (score < 0.5) { 
      return res.status(403).json({
        success: false,
        reason: 'Suspicious activity detected',
        score
      });
    }

    // Successful verification
    return res.json({
      success: true,
      redirect: process.env.REDIRECT_URL || 'https://default-redirect.com',
      score
    });

  } catch (err) {
    // Detailed error logging
    console.error('reCAPTCHA API Error:', {
      message: err.message,
      code: err.code,
      response: err.response?.data,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    return res.status(500).json({
      success: false,
      error: 'Could not verify reCAPTCHA',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// =====================
// SERVER STARTUP
// =====================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log('Active Configuration:', {
    nodeEnv: process.env.NODE_ENV,
    recaptchaConfigured: !!process.env.RECAPTCHA_SECRET,
    redirectUrl: process.env.REDIRECT_URL || 'using_default'
  });
});

// Railway optimization
server.keepAliveTimeout = 60000;
server.headersTimeout = 65000;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server terminated');
    process.exit(0);
  });
});
