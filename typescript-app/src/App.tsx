import { useState } from 'react';
import type { GameId, Player } from '../shared/contracts';
import { useAuth } from './context/AuthContext';
import Auth from './pages/Auth';
import CardDraw from './pages/CardDraw';
import DiceRoll from './pages/DiceRoll';
import GameSelect from './pages/GameSelect';
import LuckyWheel from './pages/LuckyWheel';
import PlayerSetup from './pages/PlayerSetup';
import Statistics from './pages/Statistics';
import Upgrade from './pages/Upgrade';

type Screen = 'setup' | 'auth' | 'games' | 'upgrade' | 'wheel' | 'dice' | 'cards' | 'statistics';

export default function App() {
  const { loading } = useAuth();
  const [screen, setScreen] = useState<Screen>('setup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [authReturnScreen, setAuthReturnScreen] = useState<Screen>('setup');

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

  return (
    <>
      {screen === 'setup' && (
        <PlayerSetup onStart={handleStart} onGoToAuth={() => goToAuth('setup')} />
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
          onGoToUpgrade={() => setScreen('upgrade')}
          onViewStatistics={() => setScreen('statistics')}
          onBack={() => setScreen('setup')}
        />
      )}
      {screen === 'upgrade' && (
        <Upgrade onDone={() => setScreen('games')} onGoToAuth={() => goToAuth('upgrade')} />
      )}
      {screen === 'wheel' && <LuckyWheel players={players} onBack={() => setScreen('games')} />}
      {screen === 'dice' && <DiceRoll players={players} onBack={() => setScreen('games')} />}
      {screen === 'cards' && <CardDraw players={players} onBack={() => setScreen('games')} />}
      {screen === 'statistics' && <Statistics onBack={() => setScreen('games')} />}
    </>
  );
}
