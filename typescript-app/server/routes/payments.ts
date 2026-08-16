import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { HttpError } from '../errors.js';
import {
  createPremiumPayment,
  getGoPayPayment,
  voidGoPayRecurrence,
  type GoPayPayment,
} from '../services/gopay.js';

const orderSchema = z.string().min(1).max(100);
const paymentIdSchema = z.coerce.string().min(1).max(100);

interface OrderRow {
  user_id: number;
  provider_payment_id: string | null;
  state: string;
}

async function applyVerifiedPayment(payment: GoPayPayment): Promise<void> {
  if (
    payment.amount !== config.goPay.premiumAmountMinor
    || payment.currency !== config.goPay.premiumCurrency
  ) return;

  const paymentId = String(payment.id);
  const parentId = payment.parent_id ? String(payment.parent_id) : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let userId: number | undefined;
    const existing = await client.query<OrderRow>(
      `SELECT user_id, provider_payment_id, state
       FROM payment_orders
       WHERE provider_payment_id = $1
          OR ($2::TEXT IS NOT NULL AND provider_payment_id = $2)
       ORDER BY provider_payment_id = $1 DESC
       LIMIT 1
       FOR UPDATE`,
      [paymentId, parentId],
    );
    const order = existing.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return;
    }

    if (payment.state !== 'PAID') {
      if (order.provider_payment_id === paymentId) {
        await client.query(
          `UPDATE payment_orders
           SET state = $2, updated_at = NOW()
           WHERE provider_payment_id = $1`,
          [paymentId, payment.state],
        );
      }
      await client.query('COMMIT');
      return;
    }

    if (order.provider_payment_id === paymentId) {
      const changed = await client.query<{ user_id: number }>(
        `UPDATE payment_orders
         SET state = 'PAID', updated_at = NOW()
         WHERE provider_payment_id = $1 AND state <> 'PAID'
         RETURNING user_id`,
        [paymentId],
      );
      userId = changed.rows[0]?.user_id;
    } else {
      const inserted = await client.query<{ user_id: number }>(
        `INSERT INTO payment_orders (
           user_id, order_number, provider_payment_id, amount_minor, currency, state
         )
         VALUES ($1, $2, $3, $4, $5, 'PAID')
         ON CONFLICT (provider_payment_id) DO NOTHING
         RETURNING user_id`,
        [
          order.user_id,
          `GOPAY-${paymentId}`,
          paymentId,
          payment.amount,
          payment.currency,
        ],
      );
      userId = inserted.rows[0]?.user_id;
    }

    if (userId) {
      await client.query(
        `UPDATE users
         SET premium = TRUE,
             premium_expires_at =
               GREATEST(COALESCE(premium_expires_at, NOW()), NOW()) + INTERVAL '1 month'
         WHERE id = $1`,
        [userId],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export const paymentsRouter = Router();

paymentsRouter.post('/gopay', requireAuth, async (request, response) => {
  if (!config.goPay.configured) {
    throw new HttpError(503, 'GoPay is not connected yet. Add your sandbox merchant credentials first.');
  }
  const orderNumber = `DK-${randomUUID()}`;
  await pool.query(
    `INSERT INTO payment_orders (user_id, order_number, amount_minor, currency)
     VALUES ($1, $2, $3, $4)`,
    [
      request.user!.id,
      orderNumber,
      config.goPay.premiumAmountMinor,
      config.goPay.premiumCurrency,
    ],
  );

  try {
    const payment = await createPremiumPayment({
      orderNumber,
      email: request.user!.email,
      displayName: request.user!.displayName,
    });
    if (!payment.gw_url) throw new HttpError(502, 'GoPay did not return a checkout address');
    await pool.query(
      `UPDATE payment_orders
       SET provider_payment_id = $2, state = $3, updated_at = NOW()
       WHERE order_number = $1`,
      [orderNumber, String(payment.id), payment.state],
    );
    response.status(201).json({ checkoutUrl: payment.gw_url, orderNumber });
  } catch (error) {
    await pool.query(
      `UPDATE payment_orders
       SET state = 'ERROR', error_message = $2, updated_at = NOW()
       WHERE order_number = $1`,
      [orderNumber, error instanceof Error ? error.message : 'Unknown GoPay error'],
    );
    throw error;
  }
});

paymentsRouter.all('/gopay/notification', async (request, response) => {
  const paymentId = paymentIdSchema.parse(request.query.id ?? request.body?.id);
  await applyVerifiedPayment(await getGoPayPayment(paymentId));
  response.status(200).end();
});

paymentsRouter.get('/order/:order/status', requireAuth, async (request, response) => {
  const orderNumber = orderSchema.parse(request.params.order);
  const result = await pool.query<OrderRow>(
    `SELECT user_id, provider_payment_id, state
     FROM payment_orders
     WHERE order_number = $1 AND user_id = $2`,
    [orderNumber, request.user!.id],
  );
  const order = result.rows[0];
  if (!order) throw new HttpError(404, 'Payment not found');
  if (order.provider_payment_id && order.state !== 'PAID') {
    await applyVerifiedPayment(await getGoPayPayment(order.provider_payment_id));
  }
  const refreshed = await pool.query<{ state: string }>(
    'SELECT state FROM payment_orders WHERE order_number = $1',
    [orderNumber],
  );
  response.json({ state: refreshed.rows[0].state });
});

paymentsRouter.get('/subscription/status', requireAuth, async (request, response) => {
  const result = await pool.query<{ state: string }>(
    `SELECT state
     FROM payment_orders
     WHERE user_id = $1 AND order_number LIKE 'DK-%'
     ORDER BY created_at DESC
     LIMIT 1`,
    [request.user!.id],
  );
  response.json({
    active: request.user!.premium,
    autoRenewing: result.rows[0]?.state === 'PAID',
    premiumExpiresAt: request.user!.premiumExpiresAt?.toISOString() ?? null,
  });
});

paymentsRouter.post('/subscription/cancel', requireAuth, async (request, response) => {
  const result = await pool.query<{ id: number; provider_payment_id: string }>(
    `SELECT id, provider_payment_id
     FROM payment_orders
     WHERE user_id = $1
       AND order_number LIKE 'DK-%'
       AND state = 'PAID'
       AND provider_payment_id IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [request.user!.id],
  );
  const order = result.rows[0];
  if (!order) throw new HttpError(404, 'No active GoPay subscription was found');
  await voidGoPayRecurrence(order.provider_payment_id);
  await pool.query(
    `UPDATE payment_orders
     SET state = 'RECURRENCE_CANCELED', updated_at = NOW()
     WHERE id = $1`,
    [order.id],
  );
  response.status(204).end();
});
