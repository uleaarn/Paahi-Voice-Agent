
import { OrderData, RestaurantHours } from '../types';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  next_available?: string;
}

export function validateOrder(data: OrderData, hours: RestaurantHours): ValidationResult {
  console.log(`[VALIDATION_START] Checking order for ${data.customer.name}`);
  
  const now = new Date();
  let targetMinutes: number;
  
  if (data.requested_time.toUpperCase() === 'ASAP') {
    targetMinutes = now.getHours() * 60 + now.getMinutes();
  } else {
    const parts = data.requested_time.split(':');
    if (parts.length < 2) {
      return { valid: true }; // Fallback
    }
    const [h, m] = parts.map(Number);
    targetMinutes = h * 60 + m;
  }

  const [startH, startM] = hours.order_start_time.split(':').map(Number);
  const [endH, endM] = hours.order_end_time.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (targetMinutes < startMinutes || targetMinutes > endMinutes) {
    console.warn(`[VALIDATION_RESULT] FAILED: Time ${data.requested_time} outside window ${hours.order_start_time}-${hours.order_end_time}`);
    return { 
      valid: false, 
      reason: 'OUT_OF_WINDOW', 
      next_available: hours.order_start_time 
    };
  }

  console.log(`[VALIDATION_RESULT] SUCCESS`);
  return { valid: true };
}
