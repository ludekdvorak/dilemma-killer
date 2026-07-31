import { useEffect, useState } from 'react';
import { createGoPayCheckout, getPaymentStatus, getPublicConfig } from '../api';
import type { PublicConfig } from '../../shared/contracts';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';

interface UpgradeProps {
  onDone: () => void;
  onGoToAuth: () => void;
}

export default function Upgrade({ onDone, onGoToAuth }: UpgradeProps) {
  const { user, upgradeToPremium, refreshUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const [consent, setConsent] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getPublicConfig(controller.signal)
      .then(setPublicConfig)
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : 'Could not load Premium availability');
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const order = query.get('order');
    if (query.get('payment') !== 'return' || !order || !user) return;
    const controller = new AbortController();
    setPaymentMessage('Verifying your payment with GoPay…');
    getPaymentStatus(order, controller.signal)
      .then(async ({ state }) => {
        if (state === 'PAID') {
          await refreshUser();
          setPaymentMessage('Payment confirmed. Premium is active!');
        } else {
          setPaymentMessage(`GoPay returned with status ${state}. We will activate Premium after payment confirmation.`);
        }
        window.history.replaceState({}, '', window.location.pathname);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setPaymentMessage(caught instanceof Error ? caught.message : 'Could not verify payment');
        }
      });
    return () => controller.abort();
  }, [refreshUser, user]);

  const handleDemoUpgrade = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await upgradeToPremium();
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoPay = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const checkout = await createGoPayCheckout();
      window.location.assign(checkout.checkoutUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open GoPay');
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>🎮 DILEMMA KILLER</div>
        <h1 className={styles.title}>PREMIUM</h1>
        <p>Unlock every game for <strong>€2 per month</strong>.</p>
      </header>

      <div className={styles.form}>
        {error ? (
          <div className={styles.error} role="alert">{error}</div>
        ) : !publicConfig ? (
          <p className={styles.centeredNote}>Checking Premium availability…</p>
        ) : !user ? (
          <>
            <p className={styles.centeredNote}>Please sign in before upgrading.</p>
            <button className={styles.submitBtn} onClick={onGoToAuth}>SIGN IN</button>
          </>
        ) : (
          <>
            <div className={styles.planPrice}>
              <strong>{publicConfig.premiumPrice.formatted}</strong>
              <span>/ month</span>
            </div>
            {user.premium && (
              <p className={`${styles.centeredNote} ${styles.success}`}>Premium is active on your account 🎉</p>
            )}
            {paymentMessage && <p className={styles.centeredNote} role="status">{paymentMessage}</p>}
            {!user.premium && (
              <>
                <label className={styles.consentRow}>
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  <span>
                    I agree to a recurring charge of €2 every month until cancelled and to GoPay
                    securely storing the payment-card details required for recurring billing.
                  </span>
                </label>
                <button
                  className={styles.submitBtn}
                  onClick={() => void handleGoPay()}
                  disabled={submitting || !consent || !publicConfig.goPayConfigured}
                >
                  {submitting ? 'OPENING GOPAY…' : 'PAY €2 WITH GOPAY'}
                </button>
                {!publicConfig.goPayConfigured && (
                  <p className={styles.centeredNote}>
                    GoPay Sandbox is prepared but not connected. Add your merchant GoID, Client ID,
                    Client Secret, and public app URL to enable checkout.
                  </p>
                )}
                {publicConfig.mockUpgradeEnabled && (
                  <button
                    className={styles.demoBtn}
                    onClick={() => void handleDemoUpgrade()}
                    disabled={submitting}
                  >
                    Test Premium without payment
                  </button>
                )}
              </>
            )}
          </>
        )}
        <button type="button" className={styles.skipLink} onClick={onDone} disabled={submitting}>← Back</button>
      </div>
    </main>
  );
}
