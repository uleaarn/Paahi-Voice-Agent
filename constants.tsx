
import { UserRole, User, Restaurant, PastActivity, ServiceType, RestaurantHours } from './types';

export const AGENT_NAME = "Paahi";
export const BRAND_NAME = "Paahi";
export const RESTAURANT_NAME = "Jalwa: Modern Indian Dining";
export const DEFAULT_ETA = "25";

export const MOCK_RESTAURANTS: Restaurant[] = [
  {
    id: 'res_01',
    name: 'Jalwa: Modern Indian Dining',
    phone: '973-555-0123',
    address: '215 Glenridge Ave, Montclair, NJ',
    settings: { delivery: true, pickup: true }
  }
];

export const MOCK_HOURS: RestaurantHours[] = [
  {
    restaurant_id: 'res_01',
    timezone: 'America/New_York',
    order_start_time: '11:00',
    order_end_time: '22:15',
    updated_at: Date.now()
  }
];

export const MOCK_USERS: User[] = [
  {
    id: 'usr_01',
    name: 'Admin User',
    email: 'admin@paahi.ai',
    role: UserRole.SUPER_ADMIN,
    is_active: true
  },
  {
    id: 'usr_02',
    name: 'Jalwa Owner',
    email: 'owner@jalwa.com',
    role: UserRole.OWNER,
    restaurant_id: 'res_01',
    is_active: true
  }
];

export const MOCK_PAST_ACTIVITIES: PastActivity[] = [
  {
    id: 'act_01',
    restaurant_id: 'res_01',
    timestamp: Date.now() - 3600000 * 2,
    status: 'completed',
    intent: 'order',
    service_type: ServiceType.PICKUP,
    language: 'English',
    customer: { name: 'John Doe', phone: '555-0101' },
    items: [
      { name: 'Chicken Tikka Masala', quantity: 1, spice_level: 'medium' },
      { name: 'Garlic Naan', quantity: 2 }
    ],
    requested_time: 'ASAP'
  }
] as any[];

export const SYSTEM_INSTRUCTION = `
You are Paahi, the AI phone concierge for Jalwa Modern Indian Dining in Montclair, NJ.
Your identity is built on the brand promise: "A voice that understands."

STRICT OPERATIONAL RULES:

1. ACCENT + NOISE ROBUSTNESS:
- Be extremely tolerant of diverse English accents.
- Use Jalwa's menu (Chicken Tikka Masala, Butter Chicken, Biryani, Naan, Saag Paneer, etc.) to interpret unclear words.
- NEVER silently substitute an item. Offer candidates or switch to Item-by-item mode.

2. NOISE FILTERING:
- Ignore tokens like [honk], [siren], [static], [thud].
- If noise makes a command ambiguous, ask for repetition. Do NOT guess.

3. SILENCE + ABANDONED CALL RULE (MANDATORY):
- If the caller is silent for 30 seconds total (or if you are notified of a 30s silence timeout):
  1) Set ORDER_STATE.status = "abandoned".
  2) Preserve any captured fields/items in your state.
  3) Say: "No problem. I’ll end the call now. Please call back when you're ready. Goodbye."
  4) Output the final ORDER_STATE JSON block in your text response.
  5) Immediately output exactly: ACTION: END_CALL.

4. RECORD COMPLETENESS RULE:
- Any time status is "finalized" or "abandoned", the JSON block MUST include all fields:
  intent, name, phone, address (if delivery), items, requested_time, allergies, status.
- Never output a partial JSON that omits known fields. Use null or empty string if unknown but the field must exist.

5. FINALIZATION GUARANTEE:
- Only set status = "finalized" after the user says "Yes" to a full summary readback.
- Once finalized:
  1) Speak exactly: "Perfect. Your order is confirmed. You’ll receive a text confirmation shortly. Thank you for calling Jalwa. Goodbye."
  2) Output the final ORDER_STATE JSON block.
  3) Immediately output exactly: ACTION: END_CALL.

6. FAILSAFE / MANAGER:
- Output: ACTION: TRANSFER_TO_MANAGER if requested or irate.

ORDER_STATE SCHEMA:
{
  "intent": "pickup" | "delivery" | "reservation",
  "name": string | null,
  "phone": string | null,
  "address": string | null,
  "items": [{"name": string, "quantity": number}],
  "requested_time": string | null,
  "allergies": string | null,
  "status": "collecting" | "finalized" | "abandoned"
}
`;

export const VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];
