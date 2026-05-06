import React, { useState, useRef, useEffect } from 'react';
import {
  Bot, Send, User, Sparkles, Brain, Zap, Clock,
  AlertCircle, RefreshCw
} from 'lucide-react';
import { createChatSession, sendMessage } from '../utils/geminiService';
import { auth, db } from '../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import './Chatbot.css';

/* ─── Sabit veriler ─── */
const SUGGESTED_TOPICS = [
  { icon: '🧮', label: 'Türev Hesaplama', subject: 'Matematik' },
  { icon: '⚡', label: 'Newton Hareket Yasaları', subject: 'Fizik' },
  { icon: '🧪', label: 'Mol Kavramı', subject: 'Kimya' },
  { icon: '🧬', label: 'DNA Replikasyonu', subject: 'Biyoloji' },
  { icon: '📐', label: 'Trigonometri Temelleri', subject: 'Matematik' },
  { icon: '🌊', label: 'Dalga Hareketi', subject: 'Fizik' },
  { icon: '🔥', label: 'Isı ve Sıcaklık', subject: 'Kimya' },
  { icon: '🌿', label: 'Fotosentez', subject: 'Biyoloji' },
];

const QUICK_CHIPS = [
  '📚 Konuyu Açıkla',
  '💡 İpucu Ver',
  '🧮 Formül Göster',
  '📝 Örnek Çöz',
  '✅ Doğruluğu Kontrol Et',
  '🔁 Farklı Anlat',
];

function formatTime(date) {
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Merhaba! Ben LearnUp AI — sana özel kişisel öğrenme asistanın. 🤖✨\n\nHerhangi bir ders konusunda takıldığın yeri sor, birlikte çözelim! Sol taraftaki konulardan birini seçebilir ya da doğrudan yazabilirsin.',
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const [msgCount, setMsgCount] = useState(1);

  // Gemini chat oturumu — bileşen boyunca tek oturum (konuşma geçmişi saklanır)
  const chatSessionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastSentTimeRef = useRef(0);

  // Oturumu başlat ve Firestore geçmişini yükle
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const chatsRef = collection(db, `users/${user.uid}/chats`);
          const q = query(chatsRef, orderBy('lastMessageAt', 'desc'), limit(1));
          const snap = await getDocs(q);

          if (!snap.empty) {
            const latestChatDoc = snap.docs[0];
            const chatData = latestChatDoc.data();
            const loadedMessages = chatData.messages || [];

            if (loadedMessages.length > 0) {
              const formattedMessages = loadedMessages.map(msg => ({
                ...msg,
                time: msg.time ? new Date(msg.time) : new Date()
              }));
              setMessages(formattedMessages);
              setMsgCount(formattedMessages.length);

              const history = formattedMessages.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
              }));

              chatSessionRef.current = createChatSession(history, user.uid, latestChatDoc.id);
              return;
            }
          }
          chatSessionRef.current = createChatSession([], user.uid);
        } catch (err) {
          console.error('Sohbet geçmişi yüklenirken hata:', err);
          chatSessionRef.current = createChatSession([], user.uid);
        }
      } else {
        chatSessionRef.current = createChatSession();
      }
    });

    return () => unsubscribe();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (text) => {
    const now = Date.now();
    if (now - lastSentTimeRef.current < 2000) {
      setError('Çok hızlı mesaj gönderiyorsunuz. Lütfen 2 saniye bekleyin.');
      return;
    }

    const trimmed = (text || input).trim();
    if (!trimmed || isTyping) return;
    if (!chatSessionRef.current) {
      setError('Oturum başlatılamadı. Sayfayı yenile.');
      return;
    }

    lastSentTimeRef.current = now;

    // Kullanıcı mesajını ekle
    const userMsg = { id: Date.now(), sender: 'user', text: trimmed, time: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setError(null);
    setMsgCount((c) => c + 1);

    try {
      const reply = await sendMessage(chatSessionRef.current, trimmed);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'bot', text: reply, time: new Date() },
      ]);
      setMsgCount((c) => c + 1);
    } catch (err) {
      console.error('Gemini hata:', err);
      setError('Şu an API limitleri dolu, 10 saniye sonra tekrar deneyin.');
      // Hata mesajını sohbete de ekle
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: '⏳ Şu an API limitleri dolu, 10 saniye sonra tekrar deneyin.',
          time: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTopicClick = (topic) => {
    handleSend(`${topic.icon} ${topic.label} konusunu bana açıkla.`);
  };

  const handleChipClick = (chip) => {
    const chipText = chip.split(' ').slice(1).join(' ');
    if (input.trim()) {
      handleSend(`${chipText}: ${input.trim()}`);
    } else {
      handleSend(chipText + ' hakkında yardım et.');
    }
  };

  const handleRetry = () => {
    chatSessionRef.current = createChatSession();
    setError(null);
  };

  return (
    <div className="chatbot-page animate-fade-in">
      {/* ── Sol Sidebar ── */}
      <aside className="chat-sidebar">
        {/* AI Bilgi Kartı */}
        <div className="chat-sidebar-card">
          <div className="chat-sidebar-title">
            <Sparkles size={13} />
            AI İstatistikler
          </div>
          <div className="ai-stat-row">
            <span className="ai-stat-label">Yanıtlanan Soru</span>
            <span className="ai-stat-val">{msgCount}</span>
          </div>
          <div className="ai-stat-row">
            <span className="ai-stat-label">Desteklenen Ders</span>
            <span className="ai-stat-val">8 ders</span>
          </div>
          <div className="ai-stat-row">
            <span className="ai-stat-label">Model</span>
            <span className="ai-stat-val">Gemini 1.5 Flash 8B</span>
          </div>
          <div className="ai-stat-row">
            <span className="ai-stat-label">Durum</span>
            <span className="ai-stat-val" style={{ color: error ? '#EF4444' : '#10B981' }}>
              {error ? '⚠️ Hata' : '✓ Çevrimiçi'}
            </span>
          </div>
        </div>

        {/* Önerilen Konular */}
        <div className="chat-sidebar-card" style={{ flex: 1, overflow: 'auto' }}>
          <div className="chat-sidebar-title">
            <Brain size={13} />
            Popüler Konular
          </div>
          <div className="topic-list">
            {SUGGESTED_TOPICS.map((topic, i) => (
              <button
                key={i}
                className="topic-item"
                onClick={() => handleTopicClick(topic)}
                disabled={isTyping}
              >
                <span className="topic-icon">{topic.icon}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ color: '#CBD5E1', fontWeight: 600 }}>{topic.label}</span>
                  <span style={{ fontSize: '0.72rem', color: '#475569' }}>{topic.subject}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Ana Chat Alanı ── */}
      <div className="chat-main">
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-bot">
            <div className="chat-bot-avatar-lg">
              <Bot size={24} color="white" />
            </div>
            <div>
              <div className="chat-bot-name-lg">LearnUp AI Asistan</div>
              <div className="chat-bot-desc">
                <span style={{
                  width: 7, height: 7,
                  background: error ? '#EF4444' : '#10B981',
                  borderRadius: '50%', display: 'inline-block'
                }}></span>
                {error ? 'Bağlantı hatası' : 'Gemini 2.0 Flash · Çevrimiçi'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {error && (
              <button
                className="chat-header-badge"
                onClick={handleRetry}
                style={{ cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#FCA5A5' }}
              >
                <RefreshCw size={13} />
                Yeniden Bağlan
              </button>
            )}
            <div className="chat-header-badge">
              <Zap size={13} />
              Akıllı Öğrenme Modu
            </div>
          </div>
        </div>

        {/* Quick Chips */}
        <div className="chat-chips-bar">
          {QUICK_CHIPS.map((chip, i) => (
            <button
              key={i}
              className="chat-chip"
              onClick={() => handleChipClick(chip)}
              disabled={isTyping}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{
            margin: '0.75rem 1.5rem 0',
            padding: '0.75rem 1rem',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.82rem',
            color: '#FCA5A5',
            flexShrink: 0,
          }}>
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Messages */}
        <div className="chat-messages">
          <div className="chat-date-divider">Bugün</div>

          {messages.map((msg) => (
            <div key={msg.id} className={`chat-msg-row ${msg.sender}`}>
              <div className="chat-msg-avatar">
                {msg.sender === 'bot' ? <Bot size={18} /> : <User size={18} />}
              </div>
              <div className="chat-msg-content">
                <div
                  className="chat-msg-bubble"
                  style={{
                    whiteSpace: 'pre-line',
                    ...(msg.isError ? { borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)' } : {}),
                  }}
                >
                  {msg.text}
                </div>
                <div className="chat-msg-time">
                  <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
                  {formatTime(msg.time)}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="chat-typing-row">
              <div className="chat-msg-avatar" style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))',
                color: '#A5B4FC', width: 36, height: 36, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Bot size={18} />
              </div>
              <div className="chat-typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="chat-input-bar">
          <div className="chat-input-row">
            <div className="chat-input-wrap">
              <input
                ref={inputRef}
                type="text"
                className="chat-input-field"
                placeholder="Bir konu veya soru yaz... (Enter ile gönder)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTyping}
              />
            </div>
            <button
              className="chat-send-btn"
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
            >
              <Send size={18} />
            </button>
          </div>
          <div className="chat-input-hint">
            ✨ Gemini 2.0 Flash ile çalışıyor · LearnUp AI yalnızca eğitim amaçlıdır
          </div>
        </div>
      </div>
    </div>
  );
}
