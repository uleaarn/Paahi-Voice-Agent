
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  OWNER = 'owner',
  STAFF = 'staff'
}

export enum OrderLifecycle {
  IDLE = 'IDLE',
  COLLECTING = 'COLLECTING',
  READY = 'READY',
  FINALIZING = 'FINALIZING',
  FULFILLING = 'FULFILLING',
  DONE = 'DONE',
  FAILED = 'FAILED'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  restaurant_id?: string | null;
  is_active: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  phone: string;
  address: string;
  settings: Record<string, any>;
}

export interface RestaurantHours {
  restaurant_id: string;
  timezone: string;
  order_start_time: string; // HH:mm
  order_end_time: string;   // HH:mm
  updated_at: number;
}

export enum ServiceType {
  PICKUP = 'pickup',
  DELIVERY = 'delivery'
}

export interface OrderItem {
  name: string;
  quantity: number;
  spice_level?: string | null;
  notes?: string | null;
}

export interface OrderData {
  intent: 'order' | 'pickup' | 'delivery';
  service_type?: ServiceType;
  language?: string;
  customer: {
    name: string;
    phone: string;
    address?: string | null;
  };
  items: OrderItem[];
  special_instructions?: string | null;
  requested_time: string;
  allergies?: string | null;
  status: 'collecting' | 'finalized' | 'abandoned' | 'completed';
}

export interface ReservationData {
  intent: 'reservation';
  date: string;
  time: string;
  party_size: number;
  customer_name: string;
  customer_phone: string;
  special_requests?: string | null;
  status: 'collecting' | 'finalized' | 'abandoned' | 'completed';
}

export type PastActivity = (OrderData | ReservationData) & {
  id: string;
  timestamp: number;
  restaurant_id: string;
  lifecycle?: OrderLifecycle;
};

export interface TranscriptionEntry {
  type: 'user' | 'model';
  text: string;
  timestamp: number;
}
