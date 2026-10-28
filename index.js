import Fastify from 'fastify';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';

dotenv.config();

const { GROQ_API_KEY, OPENAI_API_KEY } = process.env;
const API_KEY = GROQ_API_KEY || OPENAI_API_KEY;

const fastify = Fastify();
fastify.register(fastifyFormBody);

const SYSTEM_MESSAGE = `You are a friendly, patient, professional English-speaking coach. 
Your goal is to help me become confident and fluent in spoken English through a natural phone call conversation.

Rules:
- Keep your answers short (1 to 2 sentences) so the conversation feels fast and like a real phone call.
- Always ask one simple question at the end to keep me talking.
- If I make a grammar or vocabulary mistake, briefly show the natural way to say it, then continue.
- Speak in clear, warm, conversational American English.`;

const PORT = process.env.PORT || 5050;

fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Free AI English Tutor Server is running with Groq!' });
});

// ----------------------------------------------------------------------
// 100% Free Ultra-Fast AI Endpoint (Groq Llama 3)
// ----------------------------------------------------------------------
fastify.post('/chat', async (request, reply) => {
    try {
        const { messages } = request.body || {};

        if (!API_KEY) {
            return reply.status(500).send({ error: 'Missing GROQ_API_KEY on Render Environment.' });
        }

        // Groq API endpoint (100% free, ultra-fast)
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: SYSTEM_MESSAGE },
                    ...(messages || [])
                ],
                max_tokens: 150,
                temperature: 0.7,
            }),
        });

        const data = await response.json();

        if (data.error) {
            return reply.status(400).send({ error: data.error.message });
        }

        const replyText = data.choices?.[0]?.message?.content || 'I could not hear you clearly. Could you repeat that?';
        reply.send({ reply: replyText });

    } catch (err) {
        console.error('Chat error:', err);
        reply.status(500).send({ error: err.message });
    }
});

// ----------------------------------------------------------------------
// In-Browser Phone Call Screen (Web Speech API)
// ----------------------------------------------------------------------
fastify.get('/call', async (request, reply) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI English Tutor Call</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: space-between; height: 100vh; padding: 40px 20px; }
        .caller-info { text-align: center; margin-top: 30px; max-width: 90%; }
        .avatar { width: 110px; height: 110px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 48px; box-shadow: 0 0 25px rgba(56, 189, 248, 0.3); }
        .caller-name { font-size: 26px; font-weight: 600; margin-bottom: 6px; }
        .call-status { font-size: 16px; color: #94a3b8; line-height: 1.4; word-break: break-word; min-height: 48px; }
        .speech-box { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; font-size: 15px; color: #cbd5e1; max-width: 320px; margin: 15px auto 0; display: none; }
        .timer { font-size: 20px; font-family: monospace; color: #38bdf8; margin-top: 8px; display: none; }
        .controls { display: flex; gap: 24px; margin-bottom: 40px; }
        .btn { width: 75px; height: 75px; border-radius: 50%; border: none; font-size: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.15s ease; }
        .btn:active { transform: scale(0.92); }
        .btn-answer { background: #22c55e; color: white; box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4); }
        .btn-hangup { background: #ef4444; color: white; box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4); display: none; }
        .pulse { animation: pulse-ring 2s infinite; }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); } 70% { box-shadow: 0 0 0 20px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
    </style>
</head>
<body>
    <div class="caller-info">
        <div class="avatar" id="avatar">🎓</div>
        <div class="caller-name">AI English Tutor</div>
        <div class="call-status" id="status">Tap below to start your practice call</div>
        <div class="speech-box" id="speechBox"></div>
        <div class="timer" id="timer">00:00</div>
    </div>

    <div class="controls">
        <button class="btn btn-answer pulse" id="answerBtn" onclick="startCall()">📞</button>
        <button class="btn btn-hangup" id="hangupBtn" onclick="endCall()">📴</button>
    </div>

    <script>
        let recognition = null;
        let isCallActive = false;
        let conversationHistory = [];
        let timerInterval = null;
        let seconds = 0;

        const statusEl = document.getElementById('status');
        const speechBox = document.getElementById('speechBox');

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        function startCall() {
            if (!SpeechRecognition) {
                alert('Please open this page in Google Chrome or Safari on your phone.');
                return;
            }

            isCallActive = true;
            document.getElementById('answerBtn').style.display = 'none';
            document.getElementById('hangupBtn').style.display = 'flex';
            document.getElementById('timer').style.display = 'block';
            startTimer();

            recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.continuous = false;

            recognition.onstart = () => {
                if (isCallActive) {
                    statusEl.innerText = 'Listening... Speak now 🎙️';
                    statusEl.style.color = '#38bdf8';
                }
            };

            recognition.onresult = async (event) => {
                const userText = event.results[0][0].transcript;
                speechBox.style.display = 'block';
                speechBox.innerText = 'You: "' + userText + '"';
                
                statusEl.innerText = 'Tutor is thinking... 💭';
                statusEl.style.color = '#94a3b8';

                conversationHistory.push({ role: 'user', content: userText });
                
                try {
                    const res = await fetch('/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messages: conversationHistory })
                    });
                    const data = await res.json();

                    if (data.error) {
                        statusEl.innerText = 'Error: ' + data.error;
                        statusEl.style.color = '#f87171';
                        return;
                    }

                    const aiReply = data.reply;
                    conversationHistory.push({ role: 'assistant', content: aiReply });
                    speakReply(aiReply);

                } catch (err) {
                    statusEl.innerText = 'Connection error. Retrying...';
                    if (isCallActive) startListening();
                }
            };

            recognition.onerror = (e) => {
                console.warn('Recognition error:', e);
                if (isCallActive && e.error !== 'aborted') {
                    setTimeout(startListening, 1000);
                }
            };

            // Greeting from tutor
            const greeting = "Hello! I am your English coach. How was your day today?";
            conversationHistory.push({ role: 'assistant', content: greeting });
            speakReply(greeting);
        }

        function speakReply(text) {
            if (!isCallActive) return;

            statusEl.innerText = 'Tutor speaking... 🔊';
            statusEl.style.color = '#4ade80';

            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.95;

            const voices = window.speechSynthesis.getVoices();
            const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Natural')));
            if (englishVoice) utterance.voice = englishVoice;

            utterance.onend = () => {
                if (isCallActive) {
                    startListening();
                }
            };

            window.speechSynthesis.speak(utterance);
        }

        function startListening() {
            if (!isCallActive) return;
            try {
                recognition.start();
            } catch (err) {
                // already active
            }
        }

        function startTimer() {
            timerInterval = setInterval(() => {
                seconds++;
                const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
                const secs = String(seconds % 60).padStart(2, '0');
                document.getElementById('timer').innerText = mins + ':' + secs;
            }, 1000);
        }

        function endCall() {
            isCallActive = false;
            if (recognition) recognition.abort();
            window.speechSynthesis.cancel();
            clearInterval(timerInterval);
            statusEl.innerText = 'Call Ended. Great practice today!';
            statusEl.style.color = '#94a3b8';
            document.getElementById('hangupBtn').style.display = 'none';
        }
    </script>
</body>
</html>`;
    reply.type('text/html').send(html);
});

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`[INFO] Server running on port ${PORT}`);
});
