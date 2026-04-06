import { useState } from 'react'
import ModeToggle from './components/ModeToggle.jsx'
import GameBoard from './components/GameBoard.jsx'
import AboutModal from './components/AboutModal.jsx'
import { useGame } from './hooks/useGame.js'

export default function App() {
  const {
    mode, variant, streak,
    switchMode, submitGuess, skipTurn, newGame, advanceRound,
    gameState, campaign,
    nextVariant, allRoundsComplete,
    maxGuesses,
  } = useGame()

  const [showAbout, setShowAbout] = useState(false)

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title-row">
          <h1 className="app-title">Castword</h1>
          <button className="btn-about" onClick={() => setShowAbout(true)} aria-label="About">?</button>
        </div>
        <p className="app-subtitle">Guess the card from its unique word</p>
        <ModeToggle mode={mode} variant={variant} onSwitch={switchMode} />
      </header>
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
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
          onSkip={skipTurn}
          onPlayAgain={newGame}
          onAdvance={advanceRound}
          maxGuesses={maxGuesses}
        />
      </main>
    </div>
  )
}
