
import express from 'express';
import { WebSocketServer } from 'ws';
import { GoogleGenAI } from '@google/genai';
import twilio from 'twilio';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: false }));

const PORT = process.env.PORT || 5050;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// --- Audio Conversion Tables ---
const muLawToPcm = new Int16Array(256);
for (let i = 0; i < 256; i++) {
    let mu = ~i;
    let sign = (mu & 0x80);
    let exponent = (mu & 0x70) >> 4;
    let mantissa = mu & 0x0F;
    let sample = (mantissa << 3) + 132;
    sample <<= (exponent);
    muLawToPcm[i] = sign ? (132 - sample) : (sample - 132);
}

function pcmToMuLaw(sample) {
    let sign = (sample < 0) ? 0x80 : 0x00;
    if (sample < 0) sample = -sample;
    sample += 128;
    if (sample > 32767) sample = 32767;
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1);
    let mantissa = (sample >> (exponent + 3)) & 0x0F;
    return ~(sign | (exponent << 4) | mantissa);
}

// --- Express TwiML Endpoint ---
app.post('/voice', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const connect = twiml.connect();
    connect.stream({ url: `wss://${req.headers.host}/ws` });
    res.type('text/xml');
    res.send(twiml.toString());
});

const server = app.listen(PORT, () => console.log(`Server on ${PORT}`));
const wss = new WebSocketServer({ server, path: '/ws' });

// --- WebSocket Bridge Logic ---
wss.on('connection', (ws) => {
    console.log('[Twilio] Connection established');
    let streamSid = null;
    let callSid = null;
    let geminiSession = null;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const setupGemini = async () => {
        const session = await ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
            config: {
                responseModalities: ['AUDIO'],
                systemInstruction: process.env.SYSTEM_INSTRUCTION,
                tools: [{
                    functionDeclarations: [{
                        name: 'finalize_order',
                        parameters: {
                            type: 'OBJECT',
                            properties: {
                                items: { type: 'STRING' },
                                total: { type: 'NUMBER' },
                                customer_name: { type: 'STRING' }
                            },
                            required: ['items', 'total']
                        }
                    }]
                }]
            },
            callbacks: {
                onmessage: async (msg) => {
                    // Handle Tool Calls (n8n Integration)
                    if (msg.toolCall) {
                        for (const fc of msg.toolCall.functionCalls) {
                            if (fc.name === 'finalize_order') {
                                console.log('[n8n] Triggering workflow:', fc.args);
                                await fetch(N8N_WEBHOOK_URL, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ ...fc.args, callSid })
                                });
                                // Update session to confirm
                                session.sendToolResponse({
                                    functionResponses: { id: fc.id, name: fc.name, response: { status: 'success' } }
                                });
                            }
                        }
                    }

                    // Audio Output (Gemini -> Twilio)
                    const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (base64Audio && streamSid) {
                        const pcm24 = new Int16Array(Buffer.from(base64Audio, 'base64').buffer);
                        const muLaw = Buffer.alloc(Math.floor(pcm24.length / 3));
                        for (let i = 0; i < muLaw.length; i++) {
                            muLaw[i] = pcmToMuLaw(pcm24[i * 3]); // Downsample 24k -> 8k
                        }
                        ws.send(JSON.stringify({
                            event: 'media',
                            streamSid,
                            media: { payload: muLaw.toString('base64') }
                        }));
                    }

                    // State Transitions
                    const text = msg.serverContent?.modelTurn?.parts?.[0]?.text;
                    if (text?.includes("ACTION: END_CALL")) {
                        console.log('[Twilio] Hanging up call');
                        await twilioClient.calls(callSid).update({ status: 'completed' });
                    }
                }
            }
        });
        return session;
    };

    ws.on('message', async (data) => {
        const msg = JSON.parse(data);
        if (msg.event === 'start') {
            streamSid = msg.start.streamSid;
            callSid = msg.start.callSid;
            geminiSession = await setupGemini();
            console.log(`[Stream] Started: ${streamSid}`);
        } else if (msg.event === 'media' && geminiSession) {
            const muLaw = Buffer.from(msg.media.payload, 'base64');
            const pcm16 = new Int16Array(muLaw.length * 2);
            for (let i = 0; i < muLaw.length; i++) {
                const sample = muLawToPcm[muLaw[i]];
                pcm16[i * 2] = sample; // Upsample 8k -> 16k
                pcm16[i * 2 + 1] = sample;
            }
            geminiSession.sendRealtimeInput({
                media: { data: Buffer.from(pcm16.buffer).toString('base64'), mimeType: 'audio/pcm;rate=16000' }
            });
        }
    });

    ws.on('close', () => geminiSession?.close());
});
