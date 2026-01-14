
import { OrderLifecycle } from '../types';

const FULFILLMENT_TIMEOUT_MS = 45000;

export async function submitToPOS(order: any): Promise<boolean> {
  console.log(`[FULFILLMENT_START] Submitting to POS system...`);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error(`[FULFILLMENT_STAGE] TIMEOUT: POS did not respond in ${FULFILLMENT_TIMEOUT_MS}ms`);
      reject(new Error("POS_TIMEOUT"));
    }, FULFILLMENT_TIMEOUT_MS);

    // Simulate network delay to external API
    setTimeout(() => {
      clearTimeout(timeout);
      const success = Math.random() > 0.05; // 95% success rate for simulation
      if (success) {
        console.log(`[FULFILLMENT_STAGE] POS_ACCEPTED`);
        resolve(true);
      } else {
        console.error(`[FULFILLMENT_STAGE] POS_REJECTED`);
        reject(new Error("POS_CONNECTION_ERROR"));
      }
    }, 2000);
  });
}
