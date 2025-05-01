import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

// Initialize environment variables first
dotenv.config();

const app = express();

// Critical Railway deployment settings
app.set('trust proxy', 1); // Trust Railway's proxy
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Required for Railway

// Enhanced middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // Lock this down in production
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev')); // More concise logging format

// Rate limiting with better headers
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Health check endpoint (required by Railway)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Improved reCAPTCHA verification
app.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    const secret = process.env.SECRET_KEY;
    const redirectUrl = process.env.REDIRECT_URL || 'https://sc.com';

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
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 5000 // 5 second timeout
      }
    );

    const { success, score } = response.data;

    if (success && score > 0.5) {
      return res.json({ 
        success: true, 
        redirect: redirectUrl,
        score // For debugging
      });
    }

    return res.status(403).json({ 
      success: false,
      reason: 'reCAPTCHA verification failed',
      score
    });

  } catch (err) {
    console.error('Verification error:', {
      message: err.message,
      response: err.response?.data
    });
    
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Server startup
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log('Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT
  });
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});
