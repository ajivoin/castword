import ModeToggle from './components/ModeToggle.jsx'
import GameBoard from './components/GameBoard.jsx'
import { useGame } from './hooks/useGame.js'

export default function App() {
  const {
    mode, variant, streak,
    switchMode, submitGuess, newGame, advanceRound,
    gameState, campaign,
    nextVariant, allRoundsComplete,
    maxGuesses,
  } = useGame()

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Castword</h1>
        <p className="app-subtitle">Guess the card from its unique word</p>
        <ModeToggle mode={mode} variant={variant} onSwitch={switchMode} />
      </header>
      <main className="app-main">
        <GameBoard
          mode={mode}
          variant={variant}
          streak={streak}
          gameState={gameState}
          campaign={campaign}
          nextVariant={nextVariant}
          allRoundsComplete={allRoundsComplete}
          onGuess={submitGuess}
          onPlayAgain={newGame}
          onAdvance={advanceRound}
          maxGuesses={maxGuesses}
        />
      </main>
    </div>
  )
}
