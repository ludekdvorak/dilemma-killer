import { useEffect, useState } from 'react';
import { getPublicConfig } from '../api';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';

interface UpgradeProps {
  onDone: () => void;
  onGoToAuth: () => void;
}

export default function Upgrade({ onDone, onGoToAuth }: UpgradeProps) {
  const { user, upgradeToPremium } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockUpgradeEnabled, setMockUpgradeEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getPublicConfig(controller.signal)
      .then(({ mockUpgradeEnabled: enabled }) => setMockUpgradeEnabled(enabled))
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : 'Could not load Premium availability');
        }
      });
    return () => controller.abort();
  }, []);

  const handleUpgrade = async () => {
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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>⚔️ DILEMMA KILLER</div>
        <h1 className={styles.title}>PREMIUM</h1>
        <p>Unlock every game, including Card Draw.</p>
      </header>

      <div className={styles.form}>
        {error ? (
          <div className={styles.error} role="alert">{error}</div>
        ) : mockUpgradeEnabled === null ? (
          <p className={styles.centeredNote}>Checking Premium availability…</p>
        ) : user?.premium ? (
          <p className={`${styles.centeredNote} ${styles.success}`}>You already have Premium! 🎉</p>
        ) : mockUpgradeEnabled === false ? (
          <p className={styles.centeredNote}>Premium enrollment is not available yet.</p>
        ) : !user ? (
          <>
            <p className={styles.centeredNote}>Please sign in before upgrading.</p>
            <button className={styles.submitBtn} onClick={onGoToAuth}>SIGN IN</button>
          </>
        ) : (
          <>
            <p className={styles.centeredNote}>Demo mode unlocks Premium without payment.</p>
            <button className={styles.submitBtn} onClick={() => void handleUpgrade()} disabled={submitting}>
              {submitting ? 'PLEASE WAIT…' : 'UNLOCK DEMO PREMIUM'}
            </button>
          </>
        )}
        <button type="button" className={styles.skipLink} onClick={onDone} disabled={submitting}>← Back</button>
      </div>
    </main>
  );
}
