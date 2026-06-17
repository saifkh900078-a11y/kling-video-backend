// server.js
// Yeh server Kling AI ki Access Key aur Secret Key ko surakhit (secret) rakhta hai.
// Android app sirf isi server se baat karega, Kling ko seedha kabhi call nahi karega.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const ACCESS_KEY = process.env.KLING_ACCESS_KEY;
const SECRET_KEY = process.env.KLING_SECRET_KEY;
const KLING_BASE_URL = 'https://api-singapore.klingai.com';

if (!ACCESS_KEY || !SECRET_KEY) {
  console.warn('WARNING: KLING_ACCESS_KEY ya KLING_SECRET_KEY set nahi hain. .env file check karein.');
}

// JWT token banata hai jo Kling API ko authenticate karne ke liye chahiye hota hai.
// Yeh token 30 minute ke liye valid hota hai.
function generateKlingToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: ACCESS_KEY,
    exp: now + 1800,   // 30 minutes se expire
    nbf: now - 5       // 5 second buffer, time sync issues se bachne ke liye
  };
  return jwt.sign(payload, SECRET_KEY, { algorithm: 'HS256', header: { alg: 'HS256', typ: 'JWT' } });
}

// Health check - yeh batata hai server zinda hai
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Kling video backend chal raha hai' });
});

// Step 1: Video generation request shuru karna
app.post('/api/generate-video', async (req, res) => {
  try {
    const { prompt, aspectRatio, duration } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt (text description) zaroori hai.' });
    }

    const token = generateKlingToken();

    const response = await axios.post(
      `${KLING_BASE_URL}/v1/videos/text2video`,
      {
        model_name: 'kling-v1',
        prompt: prompt,
        aspect_ratio: aspectRatio || '9:16',
        duration: duration || '5',
        mode: 'std'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const taskId = response.data?.data?.task_id;
    res.json({ success: true, taskId: taskId });

  } catch (err) {
    console.error('Generate video error:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Video generate karne mein masla hua',
      details: err.response?.data?.message || err.message
    });
  }
});

// Step 2: Task ka status check karna (video taiyar hui ya nahi)
app.get('/api/video-status/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const token = generateKlingToken();

    const response = await axios.get(
      `${KLING_BASE_URL}/v1/videos/text2video/${taskId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    const data = response.data?.data;
    const status = data?.task_status; // submitted, processing, succeed, failed
    let videoUrl = null;

    if (status === 'succeed') {
      videoUrl = data?.task_result?.videos?.[0]?.url || null;
    }

    res.json({ status, videoUrl, raw: data });

  } catch (err) {
    console.error('Status check error:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Status check karne mein masla hua',
      details: err.response?.data?.message || err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server chal raha hai port ${PORT} par`);
});
