import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';

dotenv.config();

const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in your environment or .env file.');
    process.exit(1);
}

const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

const SYSTEM_MESSAGE = `You are my friendly, patient, professional English-speaking coach. Speak naturally in clear, simple American English. Use a warm, calm, gentleman-like voice.

Your main goal is to help me become confident and fluent in spoken English. Speak at a moderate pace, avoid complicated vocabulary, and give me time to respond.

Structure each 15-minute session:
- Minutes 0-2: Warm-up & friendly greeting.
- Minutes 2-5: Everyday conversational topic.
- Minutes 5-9: Speaking practice and pronunciation.
- Minutes 9-12: Real-world role play.
- Minutes 12-14: Up to 3 helpful corrections.
- Minutes 14-15: Recap and goodbye.`;

const PORT = process.env.PORT || 5050;

fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });
});

// Endpoint to generate an ephemeral session token with the required OpenAI-Beta header
fastify.get('/session', async (request, reply) => {
    try {
        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'realtime=v1',
            },
            body: JSON.stringify({
                model: 'gpt-4o-realtime-preview-2024-12-17',
                voice: 'alloy',
                instructions: SYSTEM_MESSAGE,
                turn_detection: { type: 'server_vad' }
            }),
        });

        const data = await response.json();
        reply.send(data);
    } catch (err) {
        console.error('Error creating OpenAI session:', err);
        reply.status(500).send({ error: { message: err.message } });
    }
});

// Browser Call Screen
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
        .caller-info { text-align: center; margin-top: 40px; max-width: 90%; }
        .avatar { width: 110px; height: 110px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 48px; box-shadow: 0 0 25px rgba(56, 189, 248, 0.3); }
        .caller-name { font-size: 26px; font-weight: 600; margin-bottom: 8px; }
        .call-status { font-size: 16px; color: #94a3b8; line-height: 1.4; word-break: break-word; }
        .error-text { color: #f87171 !important; font-weight: 500; margin-top: 10px; }
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
        <div class="timer" id="timer">00:00</div>
    </div>

    <div class="controls">
        <button class="btn btn-answer pulse" id="answerBtn" onclick="startCall()">📞</button>
        <button class="btn btn-hangup" id="hangupBtn" onclick="endCall()">📴</button>
    </div>

    <script>
        let pc = null;
        let localStream = null;
        let timerInterval = null;
        let seconds = 0;

        function showError(msg) {
            const statusEl = document.getElementById('status');
            statusEl.className = 'call-status error-text';
            statusEl.innerText = msg;
            document.getElementById('answerBtn').style.display = 'flex';
            document.getElementById('hangupBtn').style.display = 'none';
        }

        async function startCall() {
            const statusEl = document.getElementById('status');
            statusEl.className = 'call-status';
            statusEl.innerText = 'Connecting to OpenAI...';
            document.getElementById('answerBtn').style.display = 'none';
            document.getElementById('hangupBtn').style.display = 'flex';

            try {
                // 1. Get session token with beta header
                const tokenResponse = await fetch('/session');
                const sessionData = await tokenResponse.json();

                if (sessionData.error) {
                    showError('OpenAI Error: ' + (sessionData.error.message || JSON.stringify(sessionData.error)));
                    return;
                }

                if (!sessionData.client_secret || !sessionData.client_secret.value) {
                    showError('Session Error: No token received. Response: ' + JSON.stringify(sessionData));
                    return;
                }

                const EPHEMERAL_KEY = sessionData.client_secret.value;
                statusEl.innerText = 'Requesting microphone...';

                // 2. Microphone access
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (micErr) {
                    showError('Microphone Blocked: Please allow microphone access in your browser settings.');
                    return;
                }

                statusEl.innerText = 'Connecting call audio...';

                // 3. WebRTC setup with OpenAI
                pc = new RTCPeerConnection();

                const audioEl = document.createElement('audio');
                audioEl.autoplay = true;
                pc.ontrack = (event) => {
                    audioEl.srcObject = event.streams[0];
                };

                pc.addTrack(localStream.getTracks()[0]);

                const dc = pc.createDataChannel('oai-events');

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                const sdpResponse = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + EPHEMERAL_KEY,
                        'Content-Type': 'application/sdp',
                        'OpenAI-Beta': 'realtime=v1'
                    },
                    body: offer.sdp
                });

                if (!sdpResponse.ok) {
                    const errText = await sdpResponse.text();
                    showError('WebRTC Error: ' + errText);
                    return;
                }

                const answer = { type: 'answer', sdp: await sdpResponse.text() };
                await pc.setRemoteDescription(answer);

                // Connected!
                statusEl.innerText = 'In Call • Speaking English';
                document.getElementById('timer').style.display = 'block';
                startTimer();

            } catch (err) {
                console.error(err);
                showError('Error: ' + err.message);
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
            if (pc) pc.close();
            if (localStream) localStream.getTracks().forEach(track => track.stop());
            clearInterval(timerInterval);
            document.getElementById('status').innerText = 'Call Ended. Great practice!';
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
