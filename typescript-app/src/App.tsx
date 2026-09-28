import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { GameId, Player } from '../shared/contracts';
import Starfield from './components/Starfield';
import PlayerSetup from './pages/PlayerSetup';

const Auth = lazy(() => import('./pages/Auth'));
const CardDraw = lazy(() => import('./pages/CardDraw'));
const DiceRoll = lazy(() => import('./pages/DiceRoll'));
const GameSelect = lazy(() => import('./pages/GameSelect'));
const LuckyWheel = lazy(() => import('./pages/LuckyWheel'));
const Profile = lazy(() => import('./pages/Profile'));
const SlotMachine = lazy(() => import('./pages/SlotMachine'));
const Statistics = lazy(() => import('./pages/Statistics'));
const Upgrade = lazy(() => import('./pages/Upgrade'));
const Roulette = lazy(() => import('./pages/Roulette'));
const HorseRace = lazy(() => import('./pages/HorseRace'));
const TickingBomb = lazy(() => import('./pages/TickingBomb'));

type Screen = 'setup' | 'games' | 'upgrade' | GameId | 'statistics' | 'profile';

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => (
    new URLSearchParams(window.location.search).get('payment') === 'return' ? 'upgrade' : 'setup'
  ));
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'Player 1' },
    { id: '2', name: 'Player 2' },
  ]);
  const [authOpen, setAuthOpen] = useState(false);
  const [upgradeReturnScreen, setUpgradeReturnScreen] = useState<Screen>('setup');
  const [statisticsReturnScreen, setStatisticsReturnScreen] = useState<Screen>('setup');
  const authDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (authOpen) authDialog.current?.showModal();
    else authDialog.current?.close();
  }, [authOpen]);

  const handleStart = (playerList: Player[]) => {
    setPlayers(playerList);
    setScreen('games');
  };
  const goToAuth = () => setAuthOpen(true);
  const goToStatistics = () => {
    setStatisticsReturnScreen(screen);
    setScreen('statistics');
  };
  const goToUpgrade = (returnScreen: Screen) => {
    setUpgradeReturnScreen(returnScreen);
    setScreen('upgrade');
  };
  const gameProps = { players, onBack: () => setScreen('games'), onGoToAuth: goToAuth };

  return (
    <>
      <Starfield />
      <Suspense fallback={<main className="app-loading" role="status">Opening game…</main>}>
        {screen === 'setup' && (
          <PlayerSetup
            players={players}
            onPlayersChange={setPlayers}
            onStart={handleStart}
            onGoToAuth={goToAuth}
            onViewProfile={() => setScreen('profile')}
            onViewStatistics={goToStatistics}
          />
        )}
        {screen === 'games' && (
          <GameSelect
            players={players}
            onSelectGame={setScreen}
            onGoToUpgrade={() => goToUpgrade('games')}
            onGoToAuth={goToAuth}
            onViewStatistics={goToStatistics}
            onBack={() => setScreen('setup')}
          />
        )}
        {screen === 'upgrade' && (
          <Upgrade onDone={() => setScreen(upgradeReturnScreen)} onGoToAuth={goToAuth} />
        )}
        {screen === 'wheel' && <LuckyWheel {...gameProps} />}
        {screen === 'dice' && <DiceRoll {...gameProps} />}
        {screen === 'slots' && <SlotMachine {...gameProps} />}
        {screen === 'cards' && <CardDraw {...gameProps} />}
        {screen === 'roulette' && <Roulette {...gameProps} />}
        {screen === 'horserace' && <HorseRace {...gameProps} />}
        {screen === 'bomb' && <TickingBomb {...gameProps} />}
        {screen === 'statistics' && <Statistics onBack={() => setScreen(statisticsReturnScreen)} />}
        {screen === 'profile' && (
          <Profile onBack={() => setScreen('setup')} onUpgrade={() => goToUpgrade('profile')} />
        )}
      </Suspense>
      <dialog
        ref={authDialog}
        className="auth-dialog"
        aria-labelledby="auth-title"
        onCancel={() => setAuthOpen(false)}
        onClose={() => setAuthOpen(false)}
      >
        {authOpen && (
          <Suspense fallback={<p className="auth-loading" role="status">Opening sign-in…</p>}>
            <Auth onDone={() => setAuthOpen(false)} onSkip={() => setAuthOpen(false)} />
          </Suspense>
        )}
      </dialog>
    </>
  );
}
