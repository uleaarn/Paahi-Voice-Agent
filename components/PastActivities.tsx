
import React from 'react';
import { PastActivity, OrderData, ReservationData, ServiceType } from '../types';

interface PastActivitiesProps {
  activities: PastActivity[];
  onViewDetails: (data: OrderData | ReservationData) => void;
}

const PastActivities: React.FC<PastActivitiesProps> = ({ activities, onViewDetails }) => {
  return (
    <div className="glass-morphism rounded-[2rem] p-6 border border-white/10 shadow-xl overflow-hidden flex flex-col h-full">
      <h3 className="text-lg font-bold text-white mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <svg className="w-5 h-5 mr-3 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Recent Activity
        </div>
        <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-slate-500 uppercase tracking-widest">
          {activities.length} total
        </span>
      </h3>
      
      <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
        {activities.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center">
            <svg className="w-12 h-12 text-slate-800 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-slate-500 text-sm">No activity recorded yet.</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div 
              key={activity.id}
              onClick={() => onViewDetails(activity as any)}
              className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  {/* Fix: Use refined intent to distinguish order vs reservation visually */}
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
                        {/* Fix: Safely access customer fields using type narrowing from intent */}
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
                
                <div className="flex flex-col items-end space-y-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                    activity.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                  }`}>
                    {activity.status}
                  </span>
                  <span className="text-[9px] text-slate-600 font-bold group-hover:text-sky-500 flex items-center">
                    DETAILS
                    <svg className="w-2 h-2 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-white/5">
                {/* Fix: Ensure correct type narrowing for sub-components using intent */}
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
                      {/* Fix: Property 'time' is now safely accessible because intent 'reservation' narrows to ReservationData */}
                      {activity.time}
                    </span>
                    <span className="flex items-center">
                      <svg className="w-3 h-3 mr-1 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeWidth={2}/></svg>
                      {/* Fix: Property 'party_size' is now safely accessible because intent 'reservation' narrows to ReservationData */}
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
