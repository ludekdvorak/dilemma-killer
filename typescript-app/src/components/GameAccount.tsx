import { useAuth } from '../context/AuthContext';

export default function GameAccount({ onGoToAuth }: { onGoToAuth: () => void }) {
  const { user } = useAuth();
  return user ? (
    <span className="game-account" title={user.email}>
      <span className="account-dot" /> {user.displayName}{user.premium ? ' · Premium' : ''}
    </span>
  ) : (
    <button className="game-login" onClick={onGoToAuth}>
      Log in / Sign up
    </button>
  );
}
