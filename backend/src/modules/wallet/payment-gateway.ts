import { randomBytes } from 'node:crypto';

import { z } from 'zod';

import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface CreateOrderInput {
  /** Amount in paise (₹1 = 100 paise). */
  amountPaise: number;
  /** Our payment order id, echoed back by the gateway. */
  receipt: string;
}

export interface PaymentGateway {
  readonly name: 'razorpay' | 'mock';
  createOrder(input: CreateOrderInput): Promise<{ gatewayOrderId: string }>;
}

const razorpayOrder = z.object({ id: z.string().min(1), amount: z.number().int(), currency: z.string() });

const razorpay: PaymentGateway = {
  name: 'razorpay',
  async createOrder({ amountPaise, receipt }) {
    let response: Response;
    try {
      response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID ?? ''}:${env.RAZORPAY_KEY_SECRET ?? ''}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      logger.error('Razorpay order request failed', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError(502, 'GATEWAY_UNAVAILABLE', 'The payment gateway is unavailable. Try again shortly.');
    }

    if (!response.ok) {
      logger.error('Razorpay rejected order', { status: response.status });
      throw new AppError(502, 'GATEWAY_ERROR', 'The payment gateway could not create the order.');
    }

    const order = razorpayOrder.parse(await response.json());
    if (order.amount !== amountPaise || order.currency !== 'INR') {
      throw new AppError(502, 'GATEWAY_ERROR', 'The payment gateway returned an unexpected order.');
    }
    return { gatewayOrderId: order.id };
  },
};

/**
 * For local development only (refused in production by env validation). It only invents an
 * order id: tokens are still credited exclusively by a correctly signed webhook.
 */
const mock: PaymentGateway = {
  name: 'mock',
  async createOrder() {
    return { gatewayOrderId: `order_mock_${randomBytes(9).toString('hex')}` };
  },
};

export const paymentGateway: PaymentGateway = env.PAYMENT_GATEWAY === 'razorpay' ? razorpay : mock;

/** The parts of a Razorpay webhook we use. Everything else in the payload is ignored. */
export const razorpayWebhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z
      .object({
        entity: z.object({
          id: z.string().min(1),
          order_id: z.string().min(1).nullable(),
          amount: z.number().int().nonnegative(),
          currency: z.string(),
          status: z.string(),
          error_description: z.string().nullish(),
        }),
      })
      .optional(),
  }),
});

export type RazorpayWebhook = z.infer<typeof razorpayWebhookSchema>;
