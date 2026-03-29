import { useState, useEffect } from 'react'
import HintPanel from './HintPanel.jsx'
import GuessInput from './GuessInput.jsx'
import ResultModal from './ResultModal.jsx'

const HINT_EMOJIS = ['🟨', '🟧', '🟥', '⬛']

export default function GameBoard({ mode, variant, streak, gameState, onGuess, onSkip, onPlayAgain, onAdvance, maxGuesses, nextVariant, allRoundsComplete, campaign }) {
  const { card, hintsRevealed, guesses, status } = gameState
  const done = status !== 'playing'
  const [modalDismissed, setModalDismissed] = useState(false)

  // Re-show modal whenever a new game starts
  useEffect(() => { setModalDismissed(false) }, [card])

  return (
    <div className="game-board">
      <div className="attempt-counter">
        {mode === 'infinite'
          ? <span className="streak-counter">🔥 Streak: <strong>{streak}</strong></span>
          : null}
        <span>{guesses.length} / {maxGuesses} guesses</span>
      </div>

      <HintPanel card={card} hintsRevealed={hintsRevealed} status={status} variant={variant} />

      {!done && (
        <div className="guess-section">
          <div className="guess-input-row-wrap">
            <GuessInput
              onGuess={onGuess}
              disabled={done}
              pastGuesses={guesses}
            />
            {(hintsRevealed < 3 || guesses.length === maxGuesses - 1) && (
              <button
                className={guesses.length === maxGuesses - 1 ? 'btn-give-up' : 'btn-skip'}
                onClick={onSkip}
                title={guesses.length === maxGuesses - 1 ? 'End the game' : 'Reveal next hint'}
              >
                {guesses.length === maxGuesses - 1 ? 'Give Up' : 'Skip'}
              </button>
            )}
          </div>
          {guesses.length > 0 && (
            <div className="past-guesses">
              {guesses.map((g, i) => (
                <div key={i} className={`past-guess ${g.skipped ? 'skipped' : g.correct ? 'correct' : 'wrong'}`}>
                  {g.skipped ? '⬜ Skipped' : g.correct ? `🟩 ${g.value}` : `🟥 ${g.value}`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {done && modalDismissed && (
        <div className={`result-banner ${status}`}>
          <span>{status === 'won' ? '✓ Correct!' : `✗ ${card.name}`}</span>
          <span className="result-banner-guesses">
            {guesses.map((g, i) => g.correct ? '🟩' : g.skipped ? '⬜' : HINT_EMOJIS[Math.min(i, HINT_EMOJIS.length - 1)]).join('')}
          </span>
          <button className="result-banner-reopen" onClick={() => setModalDismissed(false)}>
            Details
          </button>
          {mode === 'infinite' && (
            <button className="btn-play-again" onClick={onPlayAgain}>Next</button>
          )}
          {mode === 'daily' && nextVariant && (
            <button className="btn-advance" onClick={onAdvance}>
              Next: {nextVariant === 'bonus' ? 'Flavor ✦' : nextVariant === 'wildcard' ? 'Wildcard 🃏' : nextVariant} →
            </button>
          )}
        </div>
      )}

      {done && !modalDismissed && (
        <ResultModal
          mode={mode}
          variant={variant}
          card={card}
          guesses={guesses}
          status={status}
          maxGuesses={maxGuesses}
          streak={streak}
          nextVariant={nextVariant}
          allRoundsComplete={allRoundsComplete}
          campaign={campaign}
          onPlayAgain={onPlayAgain}
          onAdvance={onAdvance}
          onDismiss={() => setModalDismissed(true)}
        />
      )}
    </div>
  )
}
