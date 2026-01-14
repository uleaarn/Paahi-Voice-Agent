
import React, { useState } from 'react';
import { RestaurantHours } from '../types';

interface OwnerSettingsProps {
  hours: RestaurantHours;
  onSave: (updated: RestaurantHours) => void;
  onClose: () => void;
}

const OwnerSettings: React.FC<OwnerSettingsProps> = ({ hours, onSave, onClose }) => {
  const [formData, setFormData] = useState<RestaurantHours>({ ...hours });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.order_end_time <= formData.order_start_time) {
      setError("Last order time must be after first order time.");
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-[#151A21] w-full max-w-lg rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Order Hours</h2>
            <p className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest mt-1">Configure Acceptance Window</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest">Timezone</label>
            <select 
              value={formData.timezone}
              onChange={(e) => setFormData({...formData, timezone: e.target.value})}
              className="w-full bg-[#10141B] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00B3A4]/50"
            >
              <option value="America/New_York">Eastern Time (New York)</option>
              <option value="America/Chicago">Central Time (Chicago)</option>
              <option value="America/Denver">Mountain Time (Denver)</option>
              <option value="America/Los_Angeles">Pacific Time (LA)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest">First Order Time</label>
              <input 
                type="time" 
                value={formData.order_start_time}
                onChange={(e) => setFormData({...formData, order_start_time: e.target.value})}
                className="w-full bg-[#10141B] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00B3A4]/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest">Last Order Time</label>
              <input 
                type="time" 
                value={formData.order_end_time}
                onChange={(e) => setFormData({...formData, order_end_time: e.target.value})}
                className="w-full bg-[#10141B] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00B3A4]/50"
              />
            </div>
          </div>

          {error && <p className="text-[#EF4444] text-[10px] font-black uppercase text-center">{error}</p>}

          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-[#00B3A4] hover:bg-[#00C7B5] text-white font-black py-4 rounded-xl shadow-xl transition-all active:scale-[0.98] uppercase tracking-widest"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OwnerSettings;
