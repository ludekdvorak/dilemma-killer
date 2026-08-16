import { useEffect, useState, type FormEvent } from 'react';
import type { SubscriptionStatus } from '../../shared/contracts';
import { cancelSubscription, getSubscriptionStatus } from '../api';
import { useAuth } from '../context/AuthContext';
import styles from './Profile.module.css';

interface ProfileProps {
  onBack: () => void;
  onUpgrade: () => void;
}

function formatExpiry(value: string | null): string {
  if (!value) return 'Active';
  return `Active until ${new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))}`;
}

export default function Profile({ onBack, onUpgrade }: ProfileProps) {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [profilePassword, setProfilePassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null);

  useEffect(() => {
    setEmail(user?.email ?? '');
    setDisplayName(user?.displayName ?? '');
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    getSubscriptionStatus(controller.signal).then(setSubscription).catch(() => undefined);
    return () => controller.abort();
  }, [user]);

  if (!user) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>ACCOUNT REQUIRED</h1>
          <p>Sign in to manage your personal details.</p>
          <button className={styles.primaryBtn} onClick={onBack}>← Back</button>
        </section>
      </main>
    );
  }

  const submitProfile = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProfileMessage(null);
    try {
      await updateProfile(email, displayName, profilePassword || undefined);
      setProfilePassword('');
      setProfileMessage('Profile saved');
    } catch (caught) {
      setProfileMessage(caught instanceof Error ? caught.message : 'Could not save profile');
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage('New passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Password changed');
    } catch (caught) {
      setPasswordMessage(caught instanceof Error ? caught.message : 'Could not change password');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Stop future €2 monthly charges? Premium stays active until the paid period ends.')) return;
    setBusy(true);
    setSubscriptionMessage(null);
    try {
      await cancelSubscription();
      setSubscription((current) => current ? { ...current, autoRenewing: false } : current);
      setSubscriptionMessage('Automatic renewal cancelled');
    } catch (caught) {
      setSubscriptionMessage(caught instanceof Error ? caught.message : 'Could not cancel renewal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Main menu</button>
        <div className={styles.logo}>🎮 DILEMMA KILLER</div>
        <div className={styles.avatar}>{user.displayName.slice(0, 1).toUpperCase()}</div>
        <h1>YOUR <span>ACCOUNT</span></h1>
        <p>Manage your identity and Premium membership.</p>
      </header>

      <section className={styles.grid}>
        <form className={styles.card} onSubmit={(event) => void submitProfile(event)}>
          <div className={styles.cardHeading}>
            <span>01</span>
            <div><h2>PERSONAL DETAILS</h2><p>How other players see you.</p></div>
          </div>
          <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={30} required /></label>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          {email !== user.email && (
            <label>Current password<input type="password" value={profilePassword} onChange={(event) => setProfilePassword(event.target.value)} autoComplete="current-password" required /></label>
          )}
          {profileMessage && <p className={profileMessage === 'Profile saved' ? styles.success : styles.error}>{profileMessage}</p>}
          <button className={styles.primaryBtn} disabled={busy}>SAVE DETAILS</button>
        </form>

        <form className={styles.card} onSubmit={(event) => void submitPassword(event)}>
          <div className={styles.cardHeading}>
            <span>02</span>
            <div><h2>SECURITY</h2><p>Choose a fresh password.</p></div>
          </div>
          <label>Current password<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
          <label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
          <label>Confirm new password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
          {passwordMessage && <p className={passwordMessage === 'Password changed' ? styles.success : styles.error}>{passwordMessage}</p>}
          <button className={styles.primaryBtn} disabled={busy}>CHANGE PASSWORD</button>
        </form>

        <article className={`${styles.card} ${styles.premiumCard}`}>
          <div className={styles.cardHeading}>
            <span>03</span>
            <div><h2>PREMIUM</h2><p>Every game, every month.</p></div>
          </div>
          <div className={styles.price}><strong>€2</strong><span>/ month</span></div>
          <p className={user.premium ? styles.success : styles.muted}>
            {user.premium ? formatExpiry(user.premiumExpiresAt) : 'Free account'}
          </p>
          {subscription?.autoRenewing && <p className={styles.muted}>Renews automatically for €2/month</p>}
          {subscriptionMessage && <p className={styles.success}>{subscriptionMessage}</p>}
          <button className={styles.goldBtn} onClick={onUpgrade}>
            {user.premium ? 'VIEW MEMBERSHIP' : 'UPGRADE WITH GOPAY'}
          </button>
          {subscription?.autoRenewing && (
            <button className={styles.cancelBtn} onClick={() => void handleCancelSubscription()} disabled={busy}>
              Cancel automatic renewal
            </button>
          )}
        </article>
      </section>

      <button className={styles.signOut} onClick={() => void logout()}>Sign out</button>
    </main>
  );
}
