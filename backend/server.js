const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const port = 5000;

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// OTP storage
const otpStore = new Map();
const OTP_EXPIRY_MS = 60000; // 1 minute

// OpenRouter API configuration
const OPENROUTER_API_KEY = 'your-openrouter-api-key';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Generate OTP
app.post('/generate-otp', (req, res) => {
  const { email } = req.body;
  
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const expiry = Date.now() + OTP_EXPIRY_MS;

  otpStore.set(email, { otp, expiry });

  console.log(`OTP for ${email}: ${otp}`);

  res.json({ 
    message: 'OTP sent successfully', 
    expiresIn: OTP_EXPIRY_MS 
  });
});

// Verify OTP and answer question
app.post('/ask', async (req, res) => {
  const { question, email, otp } = req.body;

  // First check for Java questions
  const lowerCaseQuestion = question.toLowerCase();
  if (lowerCaseQuestion.includes("java")) {
    return res.json({ 
      answer: "Sorry, I cannot answer Java-related questions. Please ask about another language.",
      javaRestricted: true
    });
  }

  // Validate inputs
  if (!question || !email || !otp) {
    return res.status(400).json({ 
      answer: "Question, email and OTP are all required",
      otpRequired: true
    });
  }

  // Verify OTP
  const storedOtp = otpStore.get(email);
  if (!storedOtp) {
    return res.status(404).json({ 
      answer: "OTP not found. Please generate a new one.",
      otpRequired: true
    });
  }

  if (Date.now() > storedOtp.expiry) {
    otpStore.delete(email);
    return res.status(400).json({ 
      answer: "OTP expired. Please generate a new one.",
      otpRequired: true
    });
  }

  if (storedOtp.otp !== otp) {
    return res.status(400).json({ 
      answer: "Invalid OTP. Please try again.",
      otpRequired: true
    });
  }

  // Process question
  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful programming assistant that refuses to answer Java-related questions."
          },
          {
            role: "user",
            content: question
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Programming Chatbot'
        },
        timeout: 10000
      }
    );

    const answer = response.data.choices[0]?.message?.content;
    if (!answer) {
      return res.status(500).json({ answer: "Sorry, I couldn't generate an answer." });
    }

    // Remove used OTP
    otpStore.delete(email);
    
    return res.json({ answer });
  } catch (error) {
    console.error('OpenRouter API error:', error.message);
    return res.status(500).json({ 
      answer: "Oops! Something went wrong with the AI service."
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});