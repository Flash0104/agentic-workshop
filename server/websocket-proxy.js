const WebSocket = require('ws');
const https = require('https');

const PORT = 8080;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment');
  process.exit(1);
}

// Create WebSocket server with explicit host binding
const wss = new WebSocket.Server({ 
  port: PORT,
  host: '0.0.0.0', // Listen on all network interfaces
  perMessageDeflate: false,
  clientTracking: true
});

console.log(`🚀 WebSocket proxy server running on ws://localhost:${PORT}`);
console.log(`📡 Proxying to OpenAI Realtime API`);
console.log(`🌐 Listening on all interfaces (0.0.0.0:${PORT})`);
console.log(``);

wss.on('connection', (clientWs, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log('✅ Client connected from:', clientIp);
  
  let openaiWs = null;
  
  // Handle messages from client
  clientWs.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // If this is the first message, it should contain the session config
      if (data.type === 'init') {
        const model = data.model || process.env.REALTIME_MODEL || 'gpt-realtime';
        const sessionConfig = data.sessionConfig || {};
        console.log(`🔗 Connecting to OpenAI with model: ${model}`);
        console.log(`📋 Session type: ${sessionConfig.type || 'realtime'}`);
        
        // Connect to OpenAI Realtime API (GA interface)
        const url = `wss://api.openai.com/v1/realtime?model=${model}`;
        const headers = {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          // Some environments require an Origin; set to app origin
          'Origin': process.env.REALTIME_ORIGIN || 'http://localhost:3000',
        };
        // If using preview model, include beta header for compatibility
        if (model.includes('preview') || process.env.FORCE_BETA_HEADER === '1') {
          headers['OpenAI-Beta'] = 'realtime=v1';
        }
        openaiWs = new WebSocket(url, { headers });
        
        openaiWs.on('open', () => {
          console.log('✅ Connected to OpenAI Realtime API (GA)');
          
          // Send minimal GA-compliant session configuration  
          // Using manual turn detection (button-based) instead of server VAD
          const sessionUpdate = {
            type: 'session.update',
            session: {
              type: sessionConfig.type || 'realtime',
              model: model,
              instructions: sessionConfig.instructions || data.instructions || '',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: null, // Disable server VAD, use manual turns
              audio: {
                // Chrome typically uses 48000Hz; match input to browser to avoid resampling artifacts
                input: { 
                  format: 'pcm16',
                  sample_rate: Number(process.env.INPUT_SAMPLE_RATE || 48000)
                },
                // Use 24000Hz output from model (common for TTS); client handles playback
                output: {
                  format: 'pcm16',
                  sample_rate: Number(process.env.OUTPUT_SAMPLE_RATE || 24000),
                  voice: (sessionConfig.voice || data.voice || 'alloy')
                }
              }
            }
          };
          console.log('📤 Sending session.update:', JSON.stringify(sessionUpdate));
          openaiWs.send(JSON.stringify(sessionUpdate));
          
          console.log('📤 Session configuration sent to OpenAI');
          
          // Notify client that connection is established
          clientWs.send(JSON.stringify({ type: 'connected' }));
        });
        
        openaiWs.on('message', (data) => {
          // Forward messages from OpenAI to client
          try {
            // Log text events only (skip binary audio to reduce noise)
            if (typeof data === 'string') {
              const parsed = JSON.parse(data);
              console.log('📨 OpenAI event:', parsed.type);
              if (parsed.type === 'error') {
                console.error('❌ OpenAI error event:', JSON.stringify(parsed, null, 2));
              }
            } else {
              console.log('🔊 OpenAI sent binary audio:', data.length, 'bytes');
            }
            
            clientWs.send(data);
          } catch (err) {
            console.error('❌ Error forwarding message to client:', err?.message || err);
          }
        });
        
        openaiWs.on('error', (error) => {
          console.error('❌ OpenAI WebSocket error:', error?.message || error);
          clientWs.send(JSON.stringify({ 
            type: 'error', 
            error: 'OpenAI connection error' 
          }));
        });
        // Capture handshake rejections (policy/headers)
        openaiWs.on('unexpectedResponse', (req, res) => {
          console.error('❌ OpenAI unexpected response:', res.statusCode, res.statusMessage);
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            console.error('❌ OpenAI response body:', body);
            try {
              clientWs.send(JSON.stringify({ type: 'error', error: `OpenAI handshake failed: ${res.statusCode} ${res.statusMessage}`, body }));
            } catch {}
            clientWs.close();
          });
        });
        
        openaiWs.on('close', (code, reason) => {
          console.log('🔌 OpenAI connection closed', code, reason?.toString?.() || '');
          try {
            clientWs.send(JSON.stringify({ type: 'disconnected' }));
          } catch {}
          clientWs.close();
        });
        
      } else {
        // Forward other messages to OpenAI
        if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.send(message);
        }
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
    }
  });
  
  clientWs.on('close', () => {
    console.log('🔌 Client disconnected');
    if (openaiWs) {
      openaiWs.close();
    }
  });
  
  clientWs.on('error', (error) => {
    console.error('❌ Client WebSocket error:', error);
  });
});

console.log('');
console.log('💡 To use this proxy, connect your client to: ws://localhost:8080');
console.log('💡 Send an init message first: { type: "init", model: "...", voice: "...", instructions: "..." }');
console.log('');

