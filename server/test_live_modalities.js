import WebSocket from 'ws';

const apiKey = process.env.GEMINI_API_KEY;
const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('WS Open. Sending setup with ["AUDIO"]...');
  ws.send(JSON.stringify({
    setup: {
      model: 'models/gemini-3.8-live',
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Aoede'
            }
          }
        }
      },
      systemInstruction: {
        parts: [{ text: 'You are an interpreter. Translate to English.' }]
      }
    }
  }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString().slice(0, 300));
  const parsed = JSON.parse(data.toString());
  if (parsed.setupComplete) {
    console.log('Setup complete! Sending test text turn...');
    ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: 'Hola mundo, esto es una prueba' }] }],
        turnComplete: true
      }
    }));
  }
  if (parsed.serverContent) {
    console.log('serverContent received! Parts:', parsed.serverContent.modelTurn?.parts?.map(p => Object.keys(p)));
    if (parsed.serverContent.turnComplete) {
      console.log('Turn complete! Success!');
      ws.close();
      process.exit(0);
    }
  }
});

ws.on('close', (code, reason) => {
  console.log('Closed:', code, reason.toString());
  process.exit(code === 1000 ? 0 : 1);
});

ws.on('error', (err) => {
  console.error('Error:', err.message);
});
