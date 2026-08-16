import { useState } from 'react';
import type { GameId, Player } from '../shared/contracts';
import { useAuth } from './context/AuthContext';
import Starfield from './components/Starfield';
import Auth from './pages/Auth';
import CardDraw from './pages/CardDraw';
import DiceRoll from './pages/DiceRoll';
import GameSelect from './pages/GameSelect';
import LuckyWheel from './pages/LuckyWheel';
import PlayerSetup from './pages/PlayerSetup';
import Profile from './pages/Profile';
import SlotMachine from './pages/SlotMachine';
import Statistics from './pages/Statistics';
import Upgrade from './pages/Upgrade';

type Screen =
  | 'setup'
  | 'auth'
  | 'games'
  | 'upgrade'
  | 'wheel'
  | 'dice'
  | 'slots'
  | 'cards'
  | 'statistics'
  | 'profile';

export default function App() {
  const { loading } = useAuth();
  const [screen, setScreen] = useState<Screen>(() => (
    new URLSearchParams(window.location.search).get('payment') === 'return' ? 'upgrade' : 'setup'
  ));
  const [players, setPlayers] = useState<Player[]>([]);
  const [authReturnScreen, setAuthReturnScreen] = useState<Screen>('setup');
  const [upgradeReturnScreen, setUpgradeReturnScreen] = useState<Screen>('setup');

  if (loading) {
    return <div className="app-loading">Loading Dilemma Killer…</div>;
  }

  const handleStart = (playerList: Player[]) => {
    setPlayers(playerList);
    setScreen('games');
  };

  const handleSelectGame = (gameId: GameId) => setScreen(gameId);

  const goToAuth = (returnScreen: Screen) => {
    setAuthReturnScreen(returnScreen);
    setScreen('auth');
  };

  const goToUpgrade = (returnScreen: Screen) => {
    setUpgradeReturnScreen(returnScreen);
    setScreen('upgrade');
  };

  return (
    <>
      <Starfield />
      {screen === 'setup' && (
        <PlayerSetup
          onStart={handleStart}
          onGoToAuth={() => goToAuth('setup')}
          onViewProfile={() => setScreen('profile')}
          onViewStatistics={() => setScreen('statistics')}
        />
      )}
      {screen === 'auth' && (
        <Auth
          onDone={() => setScreen(authReturnScreen)}
          onSkip={() => setScreen(authReturnScreen)}
        />
      )}
      {screen === 'games' && (
        <GameSelect
          players={players}
          onSelectGame={handleSelectGame}
          onGoToUpgrade={() => goToUpgrade('games')}
          onViewStatistics={() => setScreen('statistics')}
          onBack={() => setScreen('setup')}
        />
      )}
      {screen === 'upgrade' && (
        <Upgrade
          onDone={() => setScreen(upgradeReturnScreen)}
          onGoToAuth={() => goToAuth('upgrade')}
        />
      )}
      {screen === 'wheel' && <LuckyWheel players={players} onBack={() => setScreen('games')} />}
      {screen === 'dice' && <DiceRoll players={players} onBack={() => setScreen('games')} />}
      {screen === 'slots' && <SlotMachine players={players} onBack={() => setScreen('games')} />}
      {screen === 'cards' && <CardDraw players={players} onBack={() => setScreen('games')} />}
      {screen === 'statistics' && (
        <Statistics onBack={() => setScreen(players.length >= 2 ? 'games' : 'setup')} />
      )}
      {screen === 'profile' && (
        <Profile
          onBack={() => setScreen('setup')}
          onUpgrade={() => goToUpgrade('profile')}
        />
      )}
    </>
  );
}
