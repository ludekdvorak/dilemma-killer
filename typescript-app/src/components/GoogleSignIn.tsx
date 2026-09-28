import { useEffect, useRef, useState } from 'react';
import { getGoogleSignInConfig } from '../api';
import { useAuth } from '../context/AuthContext';
import styles from '../pages/Auth.module.css';

interface GoogleIdentity {
  initialize: (options: {
    client_id: string;
    nonce: string;
    callback: (response: { credential: string }) => void;
    auto_select: boolean;
  }) => void;
  renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
  cancel: () => void;
}

declare global {
  interface Window { google?: { accounts: { id: GoogleIdentity } }; }
}

let sdkPromise: Promise<GoogleIdentity> | undefined;
function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google) return Promise.resolve(window.google.accounts.id);
  sdkPromise ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => fail(), 10_000);
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error('Google could not load. You can still use email to sign in.'));
    };
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.google) resolve(window.google.accounts.id);
      else fail();
    };
    script.onerror = fail;
    document.head.append(script);
  }).catch((error: unknown) => {
    sdkPromise = undefined;
    throw error;
  });
  return sdkPromise;
}

interface GoogleSignInProps {
  disabled: boolean;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
  onError: (message: string | null) => void;
}

export default function GoogleSignIn(props: GoogleSignInProps) {
  const { loginWithGoogle } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [message, setMessage] = useState('Google sign-in is not available yet.');

  useEffect(() => {
    const controller = new AbortController();
    let submitting = false;
    void getGoogleSignInConfig(controller.signal).then(async ({ clientId, nonce }) => {
      if (controller.signal.aborted) return;
      if (!clientId || !nonce) { setStatus('unavailable'); return; }
      const google = await loadGoogleIdentity();
      if (controller.signal.aborted || !buttonRef.current) return;
      google.initialize({
        client_id: clientId,
        nonce,
        auto_select: false,
        callback: ({ credential }) => {
          if (controller.signal.aborted || submitting || callbacks.current.disabled) return;
          submitting = true;
          callbacks.current.onBusyChange(true);
          callbacks.current.onError(null);
          void loginWithGoogle(credential, controller.signal)
            .then(() => { if (!controller.signal.aborted) callbacks.current.onDone(); })
            .catch((error: unknown) => {
              if (!controller.signal.aborted) {
                callbacks.current.onError(error instanceof Error ? error.message : 'Google sign-in failed');
              }
            })
            .finally(() => {
              submitting = false;
              if (!controller.signal.aborted) callbacks.current.onBusyChange(false);
            });
        },
      });
      google.renderButton(buttonRef.current, {
        theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill',
        width: Math.min(350, Math.floor(buttonRef.current.getBoundingClientRect().width)),
      });
      setStatus('ready');
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setMessage(error instanceof Error ? error.message : 'Google sign-in is unavailable. Try email below.');
      setStatus('unavailable');
    });
    return () => {
      controller.abort();
      window.google?.accounts.id.cancel();
    };
  }, [loginWithGoogle]);

  return (
    <div className={styles.googleSection}>
      <div ref={buttonRef} className={styles.googleButton} inert={props.disabled} />
      {status === 'loading' && <p className={styles.providerNote} role="status">Loading Google sign-in…</p>}
      {status === 'unavailable' && <p className={styles.providerNote}>{message}</p>}
      <div className={styles.divider}><span>or continue with email</span></div>
    </div>
  );
}
