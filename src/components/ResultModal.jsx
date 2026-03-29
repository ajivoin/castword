import { useEffect } from 'react'
import { VARIANT_SEQUENCE, VARIANT_LABELS } from '../hooks/useGame.js'

const HINT_EMOJIS = ['🟨', '🟧', '🟥', '⬛']

function guessEmojis(guesses) {
  return guesses.map((g, i) => g.correct ? '🟩' : g.skipped ? '⬜' : HINT_EMOJIS[Math.min(i, HINT_EMOJIS.length - 1)]).join('')
}

function buildRoundShareText(guesses, maxGuesses) {
  const won   = guesses.some((g) => g.correct)
  const score = won ? guesses.length : 'X'
  return `${score}/${maxGuesses} ${guessEmojis(guesses)}`
}

function buildCampaignShareText(campaign, maxGuesses) {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const lines = [`MTG Unique Daily — ${date}`]
  for (const v of VARIANT_SEQUENCE) {
    const result = campaign[v]
    if (!result) continue
    const label = VARIANT_LABELS[v].padEnd(10)
    lines.push(`${label} ${buildRoundShareText(result.guesses, maxGuesses)}`)
  }
  return lines.join('\n')
}

function buildSingleShareText(mode, variant, guesses, maxGuesses, streak) {
  const date  = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const label = VARIANT_LABELS[variant]
  const header = mode === 'daily'
    ? `MTG Unique ${label} — ${date} ${buildRoundShareText(guesses, maxGuesses)}`
    : `MTG Unique ${label} (Infinite) ${buildRoundShareText(guesses, maxGuesses)} 🔥${streak}`
  return header
}

export default function ResultModal({
  mode, variant, card, guesses, status, maxGuesses, streak,
  nextVariant, allRoundsComplete, campaign,
  onPlayAgain, onAdvance, onDismiss,
}) {
  const won = status === 'won'

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onDismiss()
      if (e.key === 'Enter' && mode === 'infinite') onPlayAgain()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, onPlayAgain, onDismiss])

  function handleShareRound() {
    const text = buildSingleShareText(mode, variant, guesses, maxGuesses, streak)
    navigator.clipboard.writeText(text).catch(() => {})
  }

  function handleShareAll() {
    const text = buildCampaignShareText(campaign, maxGuesses)
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}>
      <div className="modal">

        {/* Header */}
        <div className="modal-header">
          <div className={`modal-result ${won ? 'won' : 'lost'}`}>
            {won ? '✓ Correct!' : '✗ Game over'}
            {mode === 'infinite' && (
              <span className="modal-streak">🔥 {streak}</span>
            )}
          </div>
          <button className="modal-close" onClick={onDismiss} aria-label="Close">✕</button>
        </div>

        {/* Card reveal */}
        <div className="modal-card">
          {card.image_url && (
            <img className="card-image" src={card.image_url} alt={card.name} loading="lazy" />
          )}
          <div className="card-details">
            <h2 className="card-name">{card.name}</h2>
            <p className="card-type">{card.type_line}</p>
            <p className="card-oracle">{card.oracle_text}</p>
            <a className="scryfall-link" href={card.scryfall_uri} target="_blank" rel="noreferrer">
              View on Scryfall ↗
            </a>
          </div>
        </div>

        {/* Guess history */}
        <div className="guess-history">
          {guesses.map((g, i) => (
            <div key={i} className={`guess-row ${g.skipped ? 'skipped' : g.correct ? 'correct' : 'wrong'}`}>
              <span className="guess-icon">{g.skipped ? '⬜' : g.correct ? '🟩' : HINT_EMOJIS[Math.min(i, HINT_EMOJIS.length - 1)]}</span>
              <span className="guess-name">{g.skipped ? 'Skipped' : g.value}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="modal-actions">
          {/* Infinite mode */}
          {mode === 'infinite' && (
            <>
              <button className="btn-share" onClick={handleShareRound}>Copy result</button>
              <button className="btn-play-again" onClick={onPlayAgain}>Next card</button>
            </>
          )}

          {/* Daily mode — more rounds available */}
          {mode === 'daily' && nextVariant && !allRoundsComplete && (
            <>
              <button className="btn-share" onClick={handleShareRound}>Copy result</button>
              <button className="btn-advance" onClick={onAdvance}>
                Next: {VARIANT_LABELS[nextVariant]} →
              </button>
            </>
          )}

          {/* Daily mode — all rounds complete */}
          {mode === 'daily' && allRoundsComplete && (
            <>
              <button className="btn-share-all" onClick={handleShareAll}>
                Share all results
              </button>
              <button className="btn-share secondary" onClick={handleShareRound}>
                Copy this round
              </button>
            </>
          )}

          {/* Daily mode — last round, not all complete (some earlier rounds skipped) */}
          {mode === 'daily' && !nextVariant && !allRoundsComplete && (
            <>
              <button className="btn-share" onClick={handleShareRound}>Copy result</button>
              <p className="daily-msg">Come back tomorrow for a new puzzle!</p>
            </>
          )}
        </div>

        {/* Campaign progress pills — daily only */}
        {mode === 'daily' && (
          <div className="campaign-progress">
            {VARIANT_SEQUENCE.map((v) => {
              const result  = campaign[v]
              const current = v === variant
              const state   = result ? result.status : current ? 'active' : 'pending'
              return (
                <span key={v} className={`campaign-pill ${state}`}>
                  {VARIANT_LABELS[v]}
                  {result && (
                    <span className="campaign-pill-score">
                      {result.status === 'won' ? ` ${result.guesses.length}/${maxGuesses}` : ' ✗'}
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
