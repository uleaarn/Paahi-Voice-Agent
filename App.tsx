
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import Header from './components/Header';
import TranscriptionLog from './components/TranscriptionLog';
import FinalDataCard from './components/FinalDataCard';
import PastActivities from './components/PastActivities';
import OwnerSettings from './components/OwnerSettings';
import { AGENT_NAME, RESTAURANT_NAME, SYSTEM_INSTRUCTION, MOCK_USERS, MOCK_RESTAURANTS, MOCK_PAST_ACTIVITIES, MOCK_HOURS, VOICES } from './constants';
import { createPcmBlob, decodeAudioData, decodeBase64, FillerManager, LatencyTracker, JitterBuffer } from './services/audioService';
import { OrderData, ReservationData, TranscriptionEntry, User, UserRole, PastActivity, RestaurantHours, ServiceType, OrderLifecycle } from './types';
import { validateOrder } from './services/orderValidation';
import { submitToPOS } from './services/fulfillment';

const FILLER_DELAY_MS = 250; 
const BARGE_IN_RMS_THRESHOLD = 0.025; 
const BARGE_IN_REQUIRED_FRAMES = 3; 
const SILENCE_TIMEOUT_MS = 30000;

type AIState = 'idle' | 'listening' | 'processing' | 'speaking';

const finalizeOrderTool: FunctionDeclaration = {
  name: 'finalize_order',
  parameters: {
    type: Type.OBJECT,
    properties: {
      service_type: { type: Type.STRING, description: 'pickup or delivery' },
      name: { type: Type.STRING, description: 'Customer full name' },
      phone: { type: Type.STRING, description: 'Customer phone number' },
      address: { type: Type.STRING, description: 'Full delivery address (required for delivery)' },
      items_json: { type: Type.STRING, description: 'A JSON array string of items.' },
      requested_time: { type: Type.STRING, description: 'Requested time (HH:mm) or "ASAP"' }
    },
    required: ['service_type', 'name', 'phone', 'items_json', 'requested_time'],
  },
};

const finalizeReservationTool: FunctionDeclaration = {
  name: 'finalize_reservation',
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: 'Date (YYYY-MM-DD)' },
      time: { type: Type.STRING, description: 'Time (HH:mm)' },
      party_size: { type: Type.NUMBER, description: 'Guests' },
      name: { type: Type.STRING, description: 'Name' },
      phone: { type: Type.STRING, description: 'Phone' },
      special_requests: { type: Type.STRING, description: 'Notes' }
    },
    required: ['date', 'time', 'party_size', 'name', 'phone'],
  },
};

const MetricsGrid: React.FC<{ stats: { count: number; revenue: string; rate: string } }> = ({ stats }) => (
  <div className="grid grid-cols-3 gap-4 mb-8">
    <div className="bg-[#151A21] p-6 rounded-3xl border border-white/5 shadow-xl">
      <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest mb-1">Total Orders</p>
      <p className="text-2xl font-black text-white">{stats.count}</p>
    </div>
    <div className="bg-[#151A21] p-6 rounded-3xl border border-white/5 shadow-xl" title="Only orders in DONE state are counted.">
      <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest mb-1">Confirmed Revenue</p>
      <p className="text-2xl font-black text-[#00B3A4]">${stats.revenue}</p>
    </div>
    <div className="bg-[#151A21] p-6 rounded-3xl border border-white/5 shadow-xl">
      <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest mb-1">Success Rate</p>
      <p className="text-2xl font-black text-blue-400">{stats.rate}%</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState('');
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  
  const [activities, setActivities] = useState<PastActivity[]>(() => {
    try {
      const saved = localStorage.getItem('paahi_activities');
      return saved ? JSON.parse(saved) : MOCK_PAST_ACTIVITIES;
    } catch (e) {
      return MOCK_PAST_ACTIVITIES;
    }
  });

  const [restaurantHours, setRestaurantHours] = useState<RestaurantHours>(MOCK_HOURS[0]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIState>('idle');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0]);
  const [transcriptionEntries, setTranscriptionEntries] = useState<TranscriptionEntry[]>([]);
  const [finalData, setFinalData] = useState<OrderData | ReservationData | null>(null);
  const [uiInput, setUiInput] = useState('');
  const [uiOutput, setUiOutput] = useState('');
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const [lifecycle, setLifecycle] = useState<OrderLifecycle>(OrderLifecycle.IDLE);
  const [lifecycleUpdateAt, setLifecycleUpdateAt] = useState<number>(Date.now());
  const [systemEvents, setSystemEvents] = useState<string[]>([]);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  
  const lifecycleRef = useRef<OrderLifecycle>(OrderLifecycle.IDLE);

  useEffect(() => {
    lifecycleRef.current = lifecycle;
    setLifecycleUpdateAt(Date.now());
  }, [lifecycle]);

  useEffect(() => {
    localStorage.setItem('paahi_activities', JSON.stringify(activities));
  }, [activities]);

  const stats = useMemo(() => {
    const completed = activities.filter(a => a.lifecycle === OrderLifecycle.DONE);
    const failed = activities.filter(a => a.lifecycle === OrderLifecycle.FAILED);
    const totalRevenue = completed.reduce((acc, curr) => {
      if (curr.intent !== 'reservation' && 'items' in curr) {
        return acc + curr.items.reduce((iAcc, item) => iAcc + (item.quantity * 14.95), 0);
      }
      return acc;
    }, 0);
    const successRate = (completed.length / (completed.length + failed.length || 1)) * 100;
    
    return {
      count: completed.length,
      revenue: totalRevenue.toFixed(2),
      rate: successRate.toFixed(0)
    };
  }, [activities]);

  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const fillerManagerRef = useRef<FillerManager | null>(null);
  const jitterBufferRef = useRef<JitterBuffer>(new JitterBuffer());
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fillerTimeoutRef = useRef<number | null>(null);
  const silenceWatchdogRef = useRef<number | null>(null);
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');
  const noiseFrameCounterRef = useRef(0);

  const logSystemEvent = useCallback((event: string) => {
    setSystemEvents(prev => [`[${new Date().toLocaleTimeString()}] ${event}`, ...prev].slice(0, 50));
  }, []);

  const updateLifecycle = useCallback((state: OrderLifecycle) => {
    console.log(`[LIFECYCLE_CHANGE] ${lifecycleRef.current} -> ${state}`);
    setLifecycle(state);
    
    if (state === OrderLifecycle.DONE || state === OrderLifecycle.FAILED) {
      setTimeout(() => cleanup(), 5000);
    }
  }, []);

  const cleanup = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    setAiStatus('idle');
    setLifecycle(OrderLifecycle.IDLE);
    lifecycleRef.current = OrderLifecycle.IDLE;
    if (fillerTimeoutRef.current) window.clearTimeout(fillerTimeoutRef.current);
    if (silenceWatchdogRef.current) window.clearTimeout(silenceWatchdogRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (sourcesRef.current.size > 0 || fillerManagerRef.current?.isPlaying) {
      sourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
      sourcesRef.current.clear();
      fillerManagerRef.current?.stopWithFade(0); 
      nextStartTimeRef.current = 0;
    }
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => { try { session.close(); } catch {} });
      sessionRef.current = null;
    }
    currentInputRef.current = '';
    currentOutputRef.current = '';
    setUiInput('');
    setUiOutput('');
  }, []);

  const forceEndCall = useCallback(() => {
    logSystemEvent('[FORCE_KILL]');
    updateLifecycle(OrderLifecycle.FAILED);
    cleanup();
  }, [cleanup, updateLifecycle, logSystemEvent]);

  const triggerHandover = useCallback((message: string) => {
    setTranscriptionEntries(prev => [...prev, {
      type: 'model',
      text: message,
      timestamp: Date.now()
    }]);
    setTimeout(() => cleanup(), 4000);
  }, [cleanup]);

  const handleOrderCompletion = useCallback(async (activityId: string, data: OrderData | ReservationData) => {
    if (lifecycleRef.current === OrderLifecycle.DONE) return;
    
    updateLifecycle(OrderLifecycle.FULFILLING);
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, lifecycle: OrderLifecycle.FULFILLING } : a));
    logSystemEvent('FULFILLMENT_START');
    console.log(`[FULFILLMENT_START] Submitting to POS...`);
    
    try {
      await submitToPOS(data);
      logSystemEvent('ORDER_DONE');
      console.log(`[ORDER_DONE] Order fulfilled successfully.`);
      
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, lifecycle: OrderLifecycle.DONE, status: 'completed' } : a));
      updateLifecycle(OrderLifecycle.DONE);
    } catch (error: any) {
      if (error.message === 'POS_TIMEOUT') {
        logSystemEvent('FULFILLMENT_TIMEOUT');
      }
      logSystemEvent('ORDER_FAILED');
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, lifecycle: OrderLifecycle.FAILED } : a));
      console.error(`[ORDER_FAILED] Fulfillment error:`, error);
      updateLifecycle(OrderLifecycle.FAILED);
      triggerHandover("I'm sorry, I'm having trouble connecting to our system. Connecting you to a human.");
    }
  }, [triggerHandover, updateLifecycle, logSystemEvent]);

  const resetSilenceTimer = useCallback(() => {
    if (silenceWatchdogRef.current) window.clearTimeout(silenceWatchdogRef.current);
    if (isActive) {
      silenceWatchdogRef.current = window.setTimeout(() => {
        console.warn("[Watchdog] 30s Silence Detected. Marking as FAILED.");
        logSystemEvent('ORDER_FAILED');
        
        const abandoned: PastActivity = {
          id: `abd_${Date.now()}`,
          timestamp: Date.now(),
          restaurant_id: currentUser?.restaurant_id || 'res_01',
          status: 'abandoned',
          intent: 'order',
          customer: { name: 'Abandoned Call', phone: '' },
          items: [],
          requested_time: 'N/A',
          lifecycle: OrderLifecycle.FAILED
        } as any;
        
        setActivities(prev => [abandoned, ...prev]);
        updateLifecycle(OrderLifecycle.FAILED);
        console.log(`[ORDER_FAILED] Abandoned due to silence.`);
        
        setTranscriptionEntries(prev => [...prev, {
          type: 'model',
          text: "No activity detected. Goodbye.",
          timestamp: Date.now()
        }]);
        
        cleanup();
      }, SILENCE_TIMEOUT_MS);
    }
  }, [isActive, currentUser, cleanup, updateLifecycle, logSystemEvent]);

  const interruptAudio = useCallback(() => {
    if (sourcesRef.current.size > 0 || fillerManagerRef.current?.isPlaying) {
      sourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
      sourcesRef.current.clear();
      fillerManagerRef.current?.stopWithFade(0); 
      nextStartTimeRef.current = 0;
      setAiStatus('listening');
    }
  }, []);

  const extractJsonBlock = useCallback((text: string) => {
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.status === 'finalized' || parsed.status === 'abandoned') {
          setFinalData(parsed);
        }
      } catch (e) {}
    }
  }, []);

  const handleFinalizeOrder = useCallback(async (args: any, id: string, session: any) => {
    logSystemEvent('FINALIZE_ORDER_RECEIVED');
    console.log(`[FINALIZE_START] Processing tool: finalize_order`);
    updateLifecycle(OrderLifecycle.FINALIZING);

    let items = [];
    try { items = JSON.parse(args.items_json); } catch (e) {
      items = [{ name: "Items", quantity: 1, notes: args.items_json }];
    }

    const data: OrderData = {
      intent: args.service_type === 'delivery' ? 'delivery' : 'pickup',
      service_type: args.service_type === 'delivery' ? ServiceType.DELIVERY : ServiceType.PICKUP,
      customer: { name: args.name, phone: args.phone, address: args.address },
      items: items,
      requested_time: args.requested_time,
      status: 'finalized'
    };

    const activity: PastActivity = {
      ...data,
      id: `act_${Date.now()}`,
      timestamp: Date.now(),
      restaurant_id: currentUser?.restaurant_id || 'res_01',
      lifecycle: OrderLifecycle.FINALIZING
    };
    setActivities(prev => [activity, ...prev]);

    const vResult = validateOrder(data, restaurantHours);
    if (!vResult.valid) {
      logSystemEvent('ORDER_FAILED');
      setActivities(prev => prev.map(a => a.id === activity.id ? { ...a, lifecycle: OrderLifecycle.FAILED } : a));
      updateLifecycle(OrderLifecycle.FAILED);
      session.sendToolResponse({
        functionResponses: {
          id, name: 'finalize_order',
          response: { error: "OUT_OF_WINDOW", start: vResult.next_available }
        }
      });
      return;
    }

    setFinalData(data);
    session.sendToolResponse({ functionResponses: { id, name: 'finalize_order', response: { result: "ok" } } });
    await handleOrderCompletion(activity.id, data);
  }, [restaurantHours, handleOrderCompletion, updateLifecycle, logSystemEvent, currentUser]);

  const handleFinalizeReservation = useCallback(async (args: any, id: string, session: any) => {
    logSystemEvent('FINALIZE_ORDER_RECEIVED');
    console.log(`[FINALIZE_START] Processing tool: finalize_reservation`);
    updateLifecycle(OrderLifecycle.FINALIZING);

    const data: ReservationData = {
      intent: 'reservation',
      date: args.date,
      time: args.time,
      party_size: Number(args.party_size),
      customer_name: args.name,
      customer_phone: args.phone,
      special_requests: args.special_requests,
      status: 'finalized'
    };

    const activity: PastActivity = {
      ...data,
      id: `res_${Date.now()}`,
      timestamp: Date.now(),
      restaurant_id: currentUser?.restaurant_id || 'res_01',
      lifecycle: OrderLifecycle.FINALIZING
    };
    setActivities(prev => [activity, ...prev]);

    setFinalData(data);
    session.sendToolResponse({ functionResponses: { id, name: 'finalize_reservation', response: { result: "ok" } } });
    await handleOrderCompletion(activity.id, data);
  }, [handleOrderCompletion, updateLifecycle, logSystemEvent, currentUser]);

  const handleToolCall = useCallback(async (fc: any, session: any) => {
    const rawName = fc.name;
    const name = rawName.toLowerCase().replace(/_/g, '');
    const { args, id } = fc;
    
    try {
      if (name === 'finalizeorder') {
        await handleFinalizeOrder(args, id, session);
      } else if (name === 'finalizereservation') {
        await handleFinalizeReservation(args, id, session);
      } else {
        console.warn(`[TOOL_CALL_IN] UNKNOWN_TOOL: ${rawName}`);
        session.sendToolResponse({ functionResponses: { id, name: rawName, response: { error: 'unsupported_tool' } } });
      }
    } catch (err) {
      console.error(`[TOOL_EXECUTION_ERROR]`, err);
      logSystemEvent('ORDER_FAILED');
      updateLifecycle(OrderLifecycle.FAILED);
      triggerHandover("Something went wrong with our digital system.");
    }
  }, [handleFinalizeOrder, handleFinalizeReservation, triggerHandover, updateLifecycle, logSystemEvent]);

  const handleToggleCall = async () => {
    if (isActive || isConnecting) { cleanup(); return; }
    setPermissionError(null);
    const micPromise = navigator.mediaDevices.getUserMedia({ audio: true });
    try {
      if (!audioContextsRef.current) {
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextsRef.current = { input: inputCtx, output: outputCtx };
        fillerManagerRef.current = new FillerManager(outputCtx);
        fillerManagerRef.current.preloadFillers().catch(() => {});
      }
      const contexts = audioContextsRef.current;
      setIsConnecting(true);
      const stream = await micPromise;
      await Promise.all([contexts.input.resume(), contexts.output.resume()]);
      streamRef.current = stream;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      updateLifecycle(OrderLifecycle.COLLECTING);
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
          systemInstruction: SYSTEM_INSTRUCTION + `\n\nWINDOW: ${restaurantHours.order_start_time}-${restaurantHours.order_end_time}`,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: [finalizeOrderTool, finalizeReservationTool] }]
        },
        callbacks: {
          onopen: () => {
            setIsActive(true); setIsConnecting(false); setAiStatus('listening');
            updateLifecycle(OrderLifecycle.READY);
            resetSilenceTimer();
            const source = contexts.input.createMediaStreamSource(stream);
            const sp = contexts.input.createScriptProcessor(4096, 1, 1);
            sp.onaudioprocess = (e) => {
              const input = e.inputBuffer.getChannelData(0);
              let sumSq = 0;
              for (let i = 0; i < input.length; i++) sumSq += input[i] * input[i];
              const rms = Math.sqrt(sumSq / input.length);
              if (rms > BARGE_IN_RMS_THRESHOLD) {
                resetSilenceTimer();
                noiseFrameCounterRef.current++;
                if (noiseFrameCounterRef.current >= BARGE_IN_REQUIRED_FRAMES) interruptAudio();
              } else { noiseFrameCounterRef.current = 0; }
              const blob = createPcmBlob(input);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: { data: blob, mimeType: 'audio/pcm;rate=16000' } });
              }).catch(() => {});
            };
            source.connect(sp); sp.connect(contexts.input.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            resetSilenceTimer();
            try {
              const base64 = message.serverContent?.modelTurn?.parts?.find(p => p.inlineData)?.inlineData?.data;
              if (base64) {
                if (fillerTimeoutRef.current) { window.clearTimeout(fillerTimeoutRef.current); fillerTimeoutRef.current = null; }
                fillerManagerRef.current?.stopWithFade(150); 
                setAiStatus('speaking');
                const { output: ctx } = contexts;
                const buffer = await decodeAudioData(decodeBase64(base64), ctx, 24000, 1);
                const startTime = jitterBufferRef.current.getAdaptiveTime(ctx.currentTime, nextStartTimeRef.current);
                const src = ctx.createBufferSource();
                src.buffer = buffer; src.connect(ctx.destination); src.start(startTime);
                nextStartTimeRef.current = startTime + buffer.duration;
                sourcesRef.current.add(src);
                src.onended = () => {
                  sourcesRef.current.delete(src);
                  if (!currentOutputRef.current && !currentInputRef.current) setAiStatus('listening');
                };
              }
              if (message.serverContent?.inputTranscription) {
                currentInputRef.current += message.serverContent.inputTranscription.text;
                setUiInput(currentInputRef.current);
                setAiStatus('processing');
                fillerTimeoutRef.current = window.setTimeout(() => {
                  fillerTimeoutRef.current = null;
                  if (isActive && !currentOutputRef.current && sourcesRef.current.size === 0) {
                    fillerManagerRef.current?.playRandomFiller(contexts.output.destination);
                    setAiStatus('speaking');
                  }
                }, FILLER_DELAY_MS);
              }
              if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                currentOutputRef.current += text;
                setUiOutput(currentOutputRef.current);
                setAiStatus('processing');

                if (currentOutputRef.current.includes("ACTION: END_CALL")) {
                   extractJsonBlock(currentOutputRef.current);
                   setTimeout(() => cleanup(), 6000); 
                } else if (currentOutputRef.current.includes("ACTION: TRANSFER_TO_MANAGER")) {
                   triggerHandover("Connecting to manager...");
                }
              }
              if (message.serverContent?.turnComplete) {
                setTranscriptionEntries(prev => [...prev, 
                  { type: 'user', text: currentInputRef.current || "(audio)", timestamp: Date.now() },
                  { type: 'model', text: currentOutputRef.current || "(audio)", timestamp: Date.now() + 1 }
                ]);
                currentInputRef.current = ''; currentOutputRef.current = '';
                setUiInput(''); setUiOutput(''); setAiStatus('listening');
              }
              if (message.toolCall) {
                sessionPromise.then(session => {
                  for (const fc of message.toolCall!.functionCalls) handleToolCall(fc, session);
                });
              }
            } catch (err) { console.error("Msg Error", err); }
          },
          onclose: () => cleanup(),
          onerror: () => cleanup()
        }
      });
      sessionRef.current = sessionPromise;
    } catch (err: any) {
      setPermissionError("Fail."); cleanup();
    }
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get('email') as string;
    const user = MOCK_USERS.find(u => u.email === email);
    if (user) { setCurrentUser(user); setView('dashboard'); } else setLoginError('Invalid credentials.');
  };

  const stuckOrders = activities.filter(a => 
    [OrderLifecycle.COLLECTING, OrderLifecycle.FINALIZING, OrderLifecycle.FULFILLING].includes(a.lifecycle!) &&
    (Date.now() - a.timestamp) > 60000
  );

  return view === 'login' ? (
    <div className="min-h-screen bg-[#0E1116] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#151A21] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <h1 className="text-4xl font-black text-white text-center mb-8 uppercase tracking-tighter">Paahi <span className="text-[#00B3A4]">Host</span></h1>
        <form onSubmit={handleLogin} className="space-y-6">
          <input name="email" type="email" required className="w-full bg-[#10141B] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#00B3A4]/50 transition-colors" placeholder="Staff Email" />
          <button type="submit" className="w-full bg-[#00B3A4] hover:bg-[#00C7B5] text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] uppercase tracking-widest">Login to Jalwa</button>
          {loginError && <p className="text-[#EF4444] text-[10px] text-center font-bold uppercase mt-2">{loginError}</p>}
        </form>
      </div>
    </div>
  ) : (
    <div className="min-h-screen bg-[#0E1116] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <Header />
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
              lifecycle === OrderLifecycle.DONE ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
              lifecycle === OrderLifecycle.FAILED ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
              lifecycle === OrderLifecycle.IDLE ? 'bg-white/5 text-slate-500 border-white/5' :
              'bg-sky-500/10 text-sky-400 border-sky-500/20 animate-pulse'
            }`}>
              State: {lifecycle}
            </div>
            {isActive && (
              <button onClick={forceEndCall} className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-full text-[9px] font-black uppercase tracking-widest transition-all">
                Force End Call
              </button>
            )}
            {currentUser?.role === UserRole.OWNER && (
              <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all text-[#6B7280]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            )}
            <button onClick={() => { cleanup(); setCurrentUser(null); setView('login'); }} className="p-3 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded-full transition-all text-[#6B7280]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>

        <MetricsGrid stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            {stuckOrders.length > 0 && (
              <div className="bg-rose-500 text-white px-6 py-4 rounded-3xl font-black uppercase tracking-widest text-[10px] flex items-center shadow-lg animate-bounce">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                ⚠ {stuckOrders.length} {stuckOrders.length === 1 ? 'ORDER' : 'ORDERS'} STUCK IN {stuckOrders[0].lifecycle}
              </div>
            )}
            <div className="bg-[#151A21] rounded-[2.5rem] p-10 flex flex-col items-center justify-center space-y-8 relative overflow-hidden shadow-2xl border border-white/5">
              <div className="relative">
                <button onClick={handleToggleCall} disabled={isConnecting} className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${isActive ? 'bg-[#EF4444]' : 'bg-[#00B3A4] hover:scale-105 active:scale-95'}`}>
                  {isActive ? <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg> : <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
                </button>
              </div>
              <div className="text-center z-10">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">{isActive ? 'Paahi Active' : 'Start Host'}</h3>
                <p className="text-[#6B7280] text-[10px] mt-2 uppercase tracking-[0.2em] font-black">{restaurantHours.order_start_time} - {restaurantHours.order_end_time}</p>
              </div>
            </div>
            <PastActivities activities={activities} onViewDetails={(d) => setFinalData(d)} />
          </div>
          <div className="lg:col-span-2 flex flex-col space-y-6">
            <div className="h-[500px] flex flex-col">
              <TranscriptionLog entries={transcriptionEntries} currentInput={uiInput} currentOutput={uiOutput} />
            </div>
            
            <div className="glass-morphism rounded-3xl overflow-hidden border border-white/5 transition-all">
              <button 
                onClick={() => setIsEventsOpen(!isEventsOpen)}
                className="w-full flex items-center justify-between px-8 py-5 text-sm font-black uppercase tracking-widest text-[#6B7280] hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center">
                  <svg className={`w-4 h-4 mr-3 transition-transform ${isEventsOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>
                  System Events
                </div>
                <span className="bg-white/5 px-3 py-1 rounded text-[10px]">{systemEvents.length} Logs</span>
              </button>
              {isEventsOpen && (
                <div className="px-8 pb-8 max-h-[250px] overflow-y-auto custom-scrollbar space-y-2 border-t border-white/5 pt-4">
                  {systemEvents.length === 0 ? (
                    <p className="text-[10px] text-slate-600 italic">No events recorded...</p>
                  ) : (
                    systemEvents.map((log, idx) => (
                      <div key={idx} className="font-mono text-[10px] text-slate-400 border-l border-white/10 pl-3 py-1">
                        {log}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <FinalDataCard data={finalData} onClear={() => setFinalData(null)} />
      </div>
      {isSettingsOpen && <OwnerSettings hours={restaurantHours} onSave={setRestaurantHours} onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
};

export default App;
