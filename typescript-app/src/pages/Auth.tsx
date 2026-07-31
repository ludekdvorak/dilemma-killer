import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';

interface AuthProps {
  onDone: () => void;
  onSkip: () => void;
}

export default function Auth({ onDone, onSkip }: AuthProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => submitControllerRef.current?.abort(), []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    submitControllerRef.current?.abort();
    const controller = new AbortController();
    submitControllerRef.current = controller;
    try {
      if (mode === 'login') await login(email, password, controller.signal);
      else await register(email, password, displayName, controller.signal);
      onDone();
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
    } finally {
      if (!controller.signal.aborted) setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>🎮 DILEMMA KILLER</div>
        <h1 className={styles.title}>{mode === 'login' ? 'SIGN IN' : 'REGISTER'}</h1>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        {mode === 'register' && (
          <label>
            <span className={styles.srOnly}>Display name</span>
            <input
              className={styles.input}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="What should we call you?"
              autoComplete="name"
              maxLength={30}
              required
            />
          </label>
        )}
        <label>
          <span className={styles.srOnly}>Email</span>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
          />
        </label>
        <label>
          <span className={styles.srOnly}>Password</span>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'register' ? 8 : undefined}
            required
          />
        </label>

        {error && <div className={styles.error} role="alert">{error}</div>}

        <button className={styles.submitBtn} type="submit" disabled={submitting}>
          {submitting ? 'PLEASE WAIT…' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>

        <div className={styles.switchRow}>
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button type="button" className={styles.switchLink} onClick={() => setMode('register')} disabled={submitting}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className={styles.switchLink} onClick={() => setMode('login')} disabled={submitting}>
                Sign in
              </button>
            </>
          )}
        </div>

        <button type="button" className={styles.skipLink} onClick={onSkip} disabled={submitting}>
          Continue without an account →
        </button>
      </form>
    </main>
  );
}
