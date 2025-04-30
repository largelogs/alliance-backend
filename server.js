const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const SECRET_KEY = process.env.SECRET_KEY;

app.post('/verify-token', async (req, res) => {
  const token = req.body.token;

  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: SECRET_KEY,
          response: token
        }
      }
    );

    const data = response.data;
    if (data.success && data.score > 0.5) {
      res.status(200).json({ success: true });
    } else {
      res.status(403).json({ success: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

app.get('/', (req, res) => {
  res.send('Backend is running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
