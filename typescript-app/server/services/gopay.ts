import { config } from '../config.js';
import { HttpError } from '../errors.js';

interface GoPayToken {
  access_token: string;
  expires_in: number;
}

export interface GoPayPayment {
  id: string | number;
  parent_id?: string | number;
  order_number?: string;
  state: string;
  amount: number;
  currency: string;
  gw_url?: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function requireConfig() {
  if (
    !config.goPay.configured
    || !config.goPay.goId
    || !config.goPay.clientId
    || !config.goPay.clientSecret
    || !config.appBaseUrl
  ) {
    throw new HttpError(503, 'GoPay is not connected yet. Add your sandbox merchant credentials first.');
  }
  return {
    goId: config.goPay.goId,
    clientId: config.goPay.clientId,
    clientSecret: config.goPay.clientSecret,
    appBaseUrl: config.appBaseUrl,
  };
}

async function accessToken(): Promise<string> {
  const credentials = requireConfig();
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  let response: Response;
  try {
    response = await fetch(`${config.goPay.gatewayUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'payment-all',
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new HttpError(502, 'GoPay is temporarily unreachable');
  }
  if (!response.ok) {
    throw new HttpError(502, 'GoPay rejected the merchant credentials');
  }
  const token = await response.json() as GoPayToken;
  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1_000,
  };
  return token.access_token;
}

async function goPayRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.goPay.gatewayUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'GoPay is temporarily unreachable');
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`GoPay request failed (${response.status})`, detail.slice(0, 1_000));
    throw new HttpError(502, 'GoPay could not create or verify the payment');
  }
  return response.json() as Promise<T>;
}

export async function createPremiumPayment(input: {
  orderNumber: string;
  email: string;
  displayName: string;
}): Promise<GoPayPayment> {
  const credentials = requireConfig();
  return goPayRequest<GoPayPayment>('/payments/payment', {
    method: 'POST',
    body: JSON.stringify({
      payer: {
        default_payment_instrument: 'PAYMENT_CARD',
        allowed_payment_instruments: ['PAYMENT_CARD'],
        contact: {
          email: input.email,
          first_name: input.displayName,
          last_name: '-',
        },
      },
      target: { type: 'ACCOUNT', goid: Number(credentials.goId) },
      amount: config.goPay.premiumAmountMinor,
      currency: config.goPay.premiumCurrency,
      order_number: input.orderNumber,
      order_description: 'Dilemma Killer Premium - monthly subscription',
      items: [{
        type: 'ITEM',
        name: 'Dilemma Killer Premium - 1 month',
        amount: config.goPay.premiumAmountMinor,
        count: 1,
      }],
      recurrence: {
        recurrence_cycle: 'MONTH',
        recurrence_period: 1,
        recurrence_date_to: '2099-12-30',
      },
      callback: {
        return_url: `${credentials.appBaseUrl}/?payment=return&order=${encodeURIComponent(input.orderNumber)}`,
        notification_url: `${credentials.appBaseUrl}/api/payments/gopay/notification`,
      },
      lang: 'EN',
    }),
  });
}

export async function getGoPayPayment(paymentId: string): Promise<GoPayPayment> {
  return goPayRequest<GoPayPayment>(`/payments/payment/${encodeURIComponent(paymentId)}`);
}

export async function voidGoPayRecurrence(paymentId: string): Promise<void> {
  const result = await goPayRequest<{ result: string }>(
    `/payments/payment/${encodeURIComponent(paymentId)}/void-recurrence`,
    { method: 'POST' },
  );
  if (result.result !== 'FINISHED') {
    throw new HttpError(502, 'GoPay did not confirm subscription cancellation');
  }
}
