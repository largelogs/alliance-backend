import express from 'express';
import axios from 'axios';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { setDefaultResultOrder } from 'dns';

// =====================
// CRITICAL RAILWAY FIXES (VPN COMPATIBILITY)
// =====================
// Forces IPv4 resolution to prevent IPv6 timeout issues common with VPNs
setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 8080;

// =====================
// MIDDLEWARE
// =====================
app.set('trust proxy', 1); // Essential for trusting X-Forwarded-For headers from proxies/VPNs

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json());
app.use(morgan('combined'));

// Relaxed rate limiting to accommodate shared VPN IPs
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200, // Increased from 100 to reduce blocks on shared VPN exit nodes
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' // Don't rate limit health checks
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
  const { token, email } = req.body; // email is base64-encoded
  const secret = process.env.RECAPTCHA_SECRET;

  // Validate token format
  if (typeof token !== 'string' || token.length < 10) {
    return res.status(400).json({ success: false, reason: 'Invalid request' });
  }

  if (!secret) {
    return res.status(500).json({ success: false, reason: 'Server configuration error' });
  }

  try {
    // Verify with Google
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      new URLSearchParams({ secret, response: token }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000 // Increased timeout slightly for slower VPN connections
      }
    );

    const { success, score, 'error-codes': errors = [] } = response.data;

    // Strict score validation
    if (!success) {
      return res.status(403).json({
        success: false,
        reason: 'Verification failed'
      });
    }

    // LOWERED THRESHOLD: 0.3 (Allows most humans, blocks obvious bots)
    if (score < 0.3) {
      return res.status(403).json({
        success: false,
        reason: 'Verification failed'
      });
    }

    // Build redirect URL with base64 email
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

// =====================
// SERVER START
// =====================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});

server.keepAliveTimeout = 60000; // Keep connections alive longer for high-latency VPNs
server.headersTimeout = 65000;
