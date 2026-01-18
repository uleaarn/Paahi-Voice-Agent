
import React, { useState, useMemo } from 'react';
import { PastActivity, OrderData, ReservationData, ServiceType, OrderLifecycle } from '../types';

interface PastActivitiesProps {
  activities: PastActivity[];
  onViewDetails: (data: OrderData | ReservationData) => void;
}

const LifecycleBadge: React.FC<{ state: OrderLifecycle }> = ({ state }) => {
  const config: Record<string, { label: string; color: string }> = {
    [OrderLifecycle.COLLECTING]: { label: 'Collecting', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    [OrderLifecycle.FINALIZING]: { label: 'Finalizing', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    [OrderLifecycle.FULFILLING]: { label: 'Sending to POS', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    [OrderLifecycle.DONE]: { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    [OrderLifecycle.FAILED]: { label: 'Failed', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
    [OrderLifecycle.READY]: { label: 'Ready', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
    [OrderLifecycle.IDLE]: { label: 'Idle', color: 'bg-white/5 text-slate-500 border-white/10' }
  };

  const { label, color } = config[state] || config[OrderLifecycle.IDLE];

  return (
    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${color}`}>
      {label}
    </span>
  );
};

const PastActivities: React.FC<PastActivitiesProps> = ({ activities, onViewDetails }) => {
  const [activeTab, setActiveTab] = useState<'recent' | 'abandoned'>('recent');

  const filteredActivities = useMemo(() => {
    if (activeTab === 'recent') {
      return activities.filter(a => a.lifecycle === OrderLifecycle.DONE || a.lifecycle === OrderLifecycle.FULFILLING);
    } else {
      return activities.filter(a => a.lifecycle === OrderLifecycle.FAILED || a.status === 'abandoned');
    }
  }, [activities, activeTab]);

  return (
    <div className="glass-morphism rounded-[2rem] p-6 border border-white/10 shadow-xl overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center">
          <svg className="w-5 h-5 mr-3 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Activity
        </h3>
        <div className="flex bg-white/5 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('recent')}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'recent' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Recent
          </button>
          <button 
            onClick={() => setActiveTab('abandoned')}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'abandoned' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Abandoned
          </button>
        </div>
      </div>
      
      <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center">
            <svg className="w-12 h-12 text-slate-800 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-slate-500 text-sm">No items in this category.</p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <div 
              key={activity.id}
              onClick={() => onViewDetails(activity as any)}
              className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    activity.intent !== 'reservation' 
                      ? 'bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20' 
                      : 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20'
                  }`}>
                    {activity.intent !== 'reservation' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
                        {activity.intent !== 'reservation' 
                          ? `Order: ${activity.customer.name}` 
                          : `Table for ${activity.customer_name}`}
                      </p>
                      {activity.intent !== 'reservation' && activity.service_type === ServiceType.DELIVERY && (
                        <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 font-black uppercase tracking-tighter">Uber Eats</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">
                      {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(activity.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-end space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                      activity.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      {activity.status}
                    </span>
                    {activity.lifecycle && <LifecycleBadge state={activity.lifecycle} />}
                  </div>
                  <span className="text-[9px] text-slate-600 font-bold group-hover:text-sky-500 flex items-center">
                    DETAILS
                    <svg className="w-2 h-2 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-white/5">
                {activity.intent !== 'reservation' ? (
                  <div className="flex flex-col space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {activity.items.map((item, idx) => (
                        <div key={idx} className="text-[10px] bg-slate-900/50 text-slate-300 px-2 py-1 rounded-lg border border-white/5 flex items-center">
                          <span className="font-bold text-sky-400 mr-1">{item.quantity}x</span>
                          <span className="truncate max-w-[100px]">{item.name}</span>
                          {item.spice_level && (
                            <span className="ml-1 text-[8px] font-black text-amber-500 bg-amber-500/10 px-1 rounded uppercase">
                              {item.spice_level.substring(0, 3)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2}/></svg>
                        {activity.service_type === ServiceType.PICKUP ? `Pickup at ${activity.requested_time}` : `Delivery: ${activity.requested_time}`}
                      </span>
                      {activity.service_type === ServiceType.DELIVERY && (
                        <span className="text-[9px] text-slate-600 truncate max-w-[150px]">
                          {activity.customer.address}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-4 text-[10px] text-slate-400">
                    <span className="flex items-center">
                      <svg className="w-3 h-3 mr-1 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2}/></svg>
                      {activity.time}
                    </span>
                    <span className="flex items-center">
                      <svg className="w-3 h-3 mr-1 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeWidth={2}/></svg>
                      {activity.party_size} Guests
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PastActivities;
