import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ClipLoader } from 'react-spinners';

function Chatbot() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const chatEndRef = useRef(null);

  // Load messages
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatbotMessages');
    setMessages(savedMessages ? JSON.parse(savedMessages) : [{
      sender: 'bot', 
      text: "👋 Hello! Please verify with OTP for each question. Note: I don't answer Java questions.", 
      time: new Date() 
    }]);
  }, []);

  // Auto-scroll and save messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    localStorage.setItem('chatbotMessages', JSON.stringify(messages));
  }, [messages]);

  // OTP countdown
  useEffect(() => {
    let interval;
    if (otpExpiry) {
      interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((otpExpiry - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) clearInterval(interval);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpExpiry]);

  const sendOtp = async () => {
    if (!email) return;
    
    try {
      setLoading(true);
      await axios.post('http://localhost:5000/generate-otp', { email });
      setOtpSent(true);
      setOtpExpiry(Date.now() + 60000);
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: `OTP sent to ${email}. Enter it below with your question (no Java questions please).`, 
        time: new Date() 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: error.response?.data?.error || "Failed to send OTP", 
        time: new Date() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const sendQuestion = async () => {
    if (!question.trim() || !otp || !email) return;

    // Client-side Java check (additional to server-side)
    if (question.toLowerCase().includes("java")) {
      setMessages(prev => [...prev, 
        { sender: 'user', text: question, time: new Date() },
        { sender: 'bot', text: "Sorry, I cannot answer Java-related questions. Please ask about another language.", time: new Date() }
      ]);
      setQuestion('');
      return;
    }

    const userMessage = { 
      sender: 'user', 
      text: question, 
      time: new Date() 
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/ask', { 
        question,
        email,
        otp
      });
      
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: response.data.answer, 
        time: new Date() 
      }]);
      
      // Reset OTP after successful question
      setOtp('');
      setOtpSent(false);
    } catch (error) {
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: error.response?.data?.answer || "Error: Please try again", 
        time: new Date() 
      }]);
    } finally {
      setQuestion('');
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendQuestion();
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const clearChat = () => {
    if (window.confirm('Clear all messages?')) {
      setMessages([{ 
        sender: 'bot', 
        text: "Chat cleared. Send a new OTP to continue (remember no Java questions).", 
        time: new Date() 
      }]);
      localStorage.removeItem('chatbotMessages');
      setEmail('');
      setOtp('');
      setOtpSent(false);
    }
  };

  return (
    <div className={`chatbot-container ${darkMode ? 'dark' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button onClick={toggleDarkMode} className="dark-mode-toggle">
          {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
        <button 
          onClick={clearChat} 
          className="dark-mode-toggle"
          style={{ backgroundColor: '#dc3545' }}
        >
          🗑️ Clear Chat
        </button>
      </div>

      <div className="chat-window">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.sender}`}>
            <div className="avatar">{msg.sender === 'bot' ? '🤖' : '🧑‍💻'}</div>
            <div className="text-bubble">
              <div className="text">{msg.text}</div>
              <div className="time">{formatTime(new Date(msg.time))}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="message bot">
            <div className="avatar">🤖</div>
            <div className="text-bubble">
              <ClipLoader size={18} color={darkMode ? "#ffffff" : "#123abc"} />
              <span style={{ marginLeft: "8px" }}>Verifying...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {!otpSent ? (
        <div className="input-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
            disabled={loading}
          />
          <button 
            onClick={sendOtp}
            disabled={loading || !email}
          >
            Send OTP
          </button>
        </div>
      ) : (
        <div className="input-form">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Your question (no Java)"
            disabled={loading}
          />
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="OTP"
            disabled={loading}
            style={{ width: '80px' }}
          />
          <button 
            onClick={sendQuestion}
            disabled={loading || !question || !otp || otp.length !== 6}
          >
            Ask
          </button>
          <button
            onClick={sendOtp}
            disabled={timeLeft > 0 || loading}
            className="resend-btn"
          >
            {timeLeft > 0 ? `${timeLeft}s` : 'Resend'}
          </button>
        </div>
      )}
    </div>
  );
}

export default Chatbot;