
import React, { useEffect, useRef } from 'react';
import { TranscriptionEntry } from '../types';

interface TranscriptionLogProps {
  entries: TranscriptionEntry[];
  currentInput: string;
  currentOutput: string;
}

const TranscriptionLog: React.FC<TranscriptionLogProps> = ({ entries, currentInput, currentOutput }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, currentInput, currentOutput]);

  return (
    <div className="glass-morphism rounded-2xl p-6 h-[400px] flex flex-col">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center">
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        Live Conversation Log
      </h2>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar"
      >
        {entries.map((entry, idx) => (
          <div 
            key={entry.timestamp + idx} 
            className={`flex ${entry.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              entry.type === 'user' 
                ? 'bg-sky-600 text-white rounded-br-none shadow-lg shadow-sky-900/20' 
                : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
            }`}>
              <p className="leading-relaxed">{entry.text}</p>
            </div>
          </div>
        ))}
        {(currentInput || currentOutput) && (
          <div className="space-y-4">
             {currentInput && (
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-sky-600/50 text-white rounded-2xl rounded-br-none px-4 py-3 text-sm italic animate-pulse">
                  {currentInput}...
                </div>
              </div>
            )}
            {currentOutput && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-slate-800/50 text-slate-300 rounded-2xl rounded-bl-none px-4 py-3 text-sm italic animate-pulse">
                  {currentOutput}...
                </div>
              </div>
            )}
          </div>
        )}
        {entries.length === 0 && !currentInput && !currentOutput && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
            <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className="text-sm">Waiting for conversation to start...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptionLog;
