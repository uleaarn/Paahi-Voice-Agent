
import React from 'react';
import { OrderData, ReservationData, ServiceType, OrderItem } from '../types';

interface FinalDataCardProps {
  data: OrderData | ReservationData | null;
  onClear: () => void;
}

const FinalDataCard: React.FC<FinalDataCardProps> = ({ data, onClear }) => {
  if (!data) return null;

  const isOrder = data.intent === 'order';
  const timestamp = new Date().toLocaleString();

  // Simple simulated price calculation for the "receipt" look
  const calculateTotal = (items: OrderItem[]) => {
    return items.reduce((acc, item) => acc + (item.quantity * 14.95), 0).toFixed(2);
  };

  const total = isOrder ? calculateTotal((data as OrderData).items) : null;
  const tax = total ? (parseFloat(total) * 0.08875).toFixed(2) : null;
  const grandTotal = total && tax ? (parseFloat(total) + parseFloat(tax)).toFixed(2) : null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm animate-in fade-in zoom-in duration-300">
        {/* Receipt Paper Effect */}
        <div className="bg-[#fdfdfc] text-slate-900 rounded-sm shadow-2xl overflow-hidden relative">
          {/* Top Jagged Edge Decoration */}
          <div className="h-3 w-full bg-[linear-gradient(45deg,transparent_33.333%,#fdfdfc_33.333%,#fdfdfc_66.666%,transparent_66.666%)] bg-[length:12px_12px] absolute -top-1.5 opacity-80"></div>
          
          <div className="p-8 font-mono text-[13px] tracking-tight">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-1">JALWA</h2>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest leading-none">Modern Indian Dining</p>
              <p className="text-[10px] text-slate-400 mt-1">215 Glenridge Ave, Montclair, NJ</p>
              <div className="border-b border-dashed border-slate-300 my-4"></div>
              <p className="text-[10px] font-bold">DATE: {timestamp}</p>
              
              {isOrder ? (
                <div className="mt-3">
                  <div className="bg-slate-900 text-white px-4 py-1.5 rounded-sm inline-block">
                    <p className="text-xs font-black uppercase tracking-[0.2em]">
                      {(data as OrderData).service_type === ServiceType.DELIVERY ? 'Uber Eats Delivery' : 'Store Pickup'}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-col items-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Scheduled Time</p>
                    <p className="text-lg font-black text-slate-900 leading-none mt-1">
                      {(data as OrderData).requested_time}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-2 bg-purple-50 p-2 border border-purple-100 rounded">
                  <p className="text-xs font-black uppercase text-purple-900">Table Reservation</p>
                </div>
              )}
            </div>

            {isOrder ? (
              <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-black uppercase border-b-2 border-slate-900 pb-1 mb-2">
                  <span className="w-8">QTY</span>
                  <span className="flex-1 px-2">ITEM DESCRIPTION</span>
                  <span className="w-16 text-right">PRICE</span>
                </div>
                
                <div className="space-y-3">
                  {(data as OrderData).items.map((item, i) => (
                    <div key={i} className="flex items-start">
                      <span className="w-8 font-bold">{item.quantity}</span>
                      <div className="flex-1 px-2">
                        <p className="font-bold leading-tight uppercase">{item.name}</p>
                        <div className="flex items-center mt-0.5 space-x-2">
                          {item.spice_level && (
                            <span className="text-[9px] bg-slate-200 px-1 rounded font-black uppercase">
                              {item.spice_level}
                            </span>
                          )}
                          {item.notes && <p className="text-[9px] text-slate-500 italic">*{item.notes}</p>}
                        </div>
                      </div>
                      <span className="w-16 text-right font-bold">
                        ${(item.quantity * 14.95).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-slate-300 my-4 pt-4 space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium uppercase">Subtotal</span>
                    <span className="font-bold">${total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium uppercase">Sales Tax (8.875%)</span>
                    <span className="font-bold">${tax}</span>
                  </div>
                  <div className="flex justify-between text-base pt-2 border-t-2 border-slate-900">
                    <span className="font-black uppercase">Total</span>
                    <span className="font-black">${grandTotal}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 my-4 pt-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Customer Record</p>
                  <p className="font-black text-slate-900">{(data as OrderData).customer.name}</p>
                  <p className="text-[11px] font-medium">{(data as OrderData).customer.phone}</p>
                  {(data as OrderData).customer.address && (
                    <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-sm">
                      <p className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">Delivery To:</p>
                      <p className="text-[10px] leading-tight text-slate-700 font-bold uppercase">{(data as OrderData).customer.address}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-sm">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-3">Confirmation Summary</p>
                  <div className="grid grid-cols-2 gap-y-3">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-500">Date</p>
                      <p className="font-bold">{(data as ReservationData).date}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-500">Time</p>
                      <p className="font-bold">{(data as ReservationData).time}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-500">Party Size</p>
                      <p className="font-bold">{(data as ReservationData).party_size} GUESTS</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 my-4 pt-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Guest Contact</p>
                  <p className="font-black text-slate-900 uppercase">{(data as ReservationData).customer_name}</p>
                  <p className="text-[11px]">{(data as ReservationData).customer_phone}</p>
                  {(data as ReservationData).special_requests && (
                    <div className="mt-3 border-l-2 border-slate-200 pl-3">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Special Requests</p>
                      <p className="text-[11px] italic text-slate-600 mt-1">"{ (data as ReservationData).special_requests }"</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-dashed border-slate-300 my-4 pt-6 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4 opacity-30 italic">Thank you for dining with Jalwa</p>
              
              <div className="flex flex-col space-y-2 no-print">
                <button 
                  onClick={onClear}
                  className="w-full bg-slate-900 text-white font-black py-4 uppercase tracking-[0.2em] text-[11px] hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98]"
                >
                  Confirm & Push to POS
                </button>
                <button 
                  onClick={onClear}
                  className="w-full text-slate-400 font-bold py-2 uppercase text-[9px] hover:text-slate-600 transition-colors"
                >
                  Discard Receipt
                </button>
              </div>
            </div>
            
            {/* Barcode simulation */}
            <div className="flex flex-col items-center mt-4 opacity-40">
              <div className="flex space-x-[1px] h-8 items-end">
                {[1,3,1,2,4,1,3,2,1,4,2,3,1,2,1,4,2].map((w, i) => (
                  <div key={i} className="bg-slate-900" style={{ width: `${w}px`, height: '100%' }}></div>
                ))}
              </div>
              <p className="text-[8px] mt-1 font-bold">#ORD-{Math.floor(Math.random() * 900000) + 100000}</p>
            </div>
          </div>
          
          {/* Bottom Jagged Edge Decoration */}
          <div className="h-3 w-full bg-[linear-gradient(45deg,#fdfdfc_33.333%,transparent_33.333%,transparent_66.666%,#fdfdfc_66.666%)] bg-[length:12px_12px] absolute -bottom-1.5 opacity-80"></div>
        </div>
      </div>
    </div>
  );
};

export default FinalDataCard;
