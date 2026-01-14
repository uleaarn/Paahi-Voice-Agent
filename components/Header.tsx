
import React from 'react';
import { BRAND_NAME, RESTAURANT_NAME } from '../constants';

const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between p-6 glass-morphism rounded-3xl mb-8 border border-white/5">
      <div className="flex items-center space-x-5">
        <div className="flex items-center justify-center">
          {/* Recreated Paahi Stylized Logo */}
          <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white drop-shadow-sm">
            <path d="M30 25V75M30 25H55C65 25 70 32 70 40C70 48 65 55 55 55H30" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M45 55V85" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="75" cy="75" r="4" fill="currentColor" />
          </svg>
        </div>
        <div className="flex flex-col">
          <h1 className="text-3xl font-light tracking-tight text-white leading-none">
            {BRAND_NAME}
          </h1>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em] mt-2 opacity-80">
            A Voice That Understands.
          </p>
        </div>
      </div>
      
      <div className="hidden md:flex flex-col items-end space-y-1">
        <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10 flex items-center space-x-3">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">AI Assistant Online</span>
        </div>
        <p className="text-[10px] text-sky-400 font-bold uppercase tracking-widest">{RESTAURANT_NAME}</p>
      </div>
    </header>
  );
};

export default Header;
