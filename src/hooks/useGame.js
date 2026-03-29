import { useState, useCallback, useEffect, useRef } from 'react'
import gameData from '../data/game-data.json'
import flavorData from '../data/flavor-data.json'
import wildcardData from '../data/wildcard-data.json'

const MAX_GUESSES = 4

const DATA = { normal: gameData, bonus: flavorData, wildcard: wildcardData }

export const VARIANT_SEQUENCE = ['normal', 'bonus', 'wildcard']
export const VARIANT_LABELS   = { normal: 'Oracle', bonus: 'Flavor ✦', wildcard: 'Wildcard 🃏' }

// ── Storage helpers ──────────────────────────────────────────────────────────

function todayIndex() {
  return Math.floor(Date.now() / 86_400_000)
}

function dailyKey(variant) {
  return `mtg-unique-daily-${variant}-${todayIndex()}`
}

function campaignKey() {
  return `mtg-unique-campaign-${todayIndex()}`
}

function loadDailyState(variant) {
  try {
    const raw = localStorage.getItem(dailyKey(variant))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveDailyState(variant, state) {
  try { localStorage.setItem(dailyKey(variant), JSON.stringify(state)) }
  catch {}
}

function loadCampaign() {
  try { return JSON.parse(localStorage.getItem(campaignKey())) ?? {} }
  catch { return {} }
}

function saveCampaign(data) {
  try { localStorage.setItem(campaignKey(), JSON.stringify(data)) }
  catch {}
}

// ── Card selection ───────────────────────────────────────────────────────────

function pickDailyCard(variant) {
  const pool = DATA[variant]
  return pool[todayIndex() % pool.length]
}

function pickRandomCard(variant, excludeName) {
  const pool = DATA[variant]
  let card
  do {
    card = pool[Math.floor(Math.random() * pool.length)]
  } while (excludeName && card.name === excludeName)
  return card
}

const initialPlayState = (card) => ({
  card,
  hintsRevealed: 0,
  guesses: [],
  status: 'playing',
})

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGame() {
  const [mode, setMode]       = useState('daily')
  const [variant, setVariant] = useState('normal')
  const [streak, setStreak]   = useState(0)

  const [gameState, setGameState] = useState(() => {
    const saved = loadDailyState('normal')
    return saved ?? initialPlayState(pickDailyCard('normal'))
  })

  // Campaign: records each completed daily round { [variant]: { guesses, status } }
  // Backfill from daily states so rounds completed before this feature existed are included.
  const [campaign, setCampaign] = useState(() => {
    const saved = loadCampaign()
    const backfilled = { ...saved }
    for (const v of VARIANT_SEQUENCE) {
      if (!backfilled[v]) {
        const ds = loadDailyState(v)
        if (ds && ds.status !== 'playing') {
          backfilled[v] = { guesses: ds.guesses, status: ds.status }
        }
      }
    }
    return backfilled
  })

  // Record campaign entry when a daily game finishes
  useEffect(() => {
    if (mode !== 'daily') return
    const { status, guesses } = gameState
    if (status !== 'won' && status !== 'lost') return
    setCampaign((prev) => {
      if (prev[variant]) return prev
      const updated = { ...prev, [variant]: { guesses, status } }
      saveCampaign(updated)
      return updated
    })
  }, [mode, variant, gameState.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derived campaign state
  const currentIdx       = VARIANT_SEQUENCE.indexOf(variant)
  const nextVariant      = (mode === 'daily' && gameState.status !== 'playing' && currentIdx < VARIANT_SEQUENCE.length - 1)
    ? VARIANT_SEQUENCE[currentIdx + 1]
    : null
  const allRoundsComplete = VARIANT_SEQUENCE.every((v) => !!campaign[v])

  // Infinite mode stash — persists cards across tab switches
  const infiniteStash  = useRef({})
  const gameStateRef   = useRef(gameState)
  const streakRef      = useRef(streak)
  useEffect(() => { gameStateRef.current = gameState }, [gameState])
  useEffect(() => { streakRef.current   = streak     }, [streak])

  const switchMode = useCallback((newMode, newVariant) => {
    const m = newMode    ?? mode
    const v = newVariant ?? variant

    if (mode === 'infinite') {
      infiniteStash.current[variant] = {
        gameState: gameStateRef.current,
        streak:    streakRef.current,
      }
    }

    setMode(m)
    setVariant(v)

    if (m === 'daily') {
      setStreak(0)
      const saved = loadDailyState(v)
      setGameState(saved ?? initialPlayState(pickDailyCard(v)))
    } else {
      const stash = infiniteStash.current[v]
      if (stash) {
        setGameState(stash.gameState)
        setStreak(stash.streak)
      } else {
        setGameState(initialPlayState(pickRandomCard(v)))
        setStreak(0)
      }
    }
  }, [mode, variant])

  // Persist daily state on every change
  useEffect(() => {
    if (mode === 'daily') saveDailyState(variant, gameState)
  }, [mode, variant, gameState])

  const submitGuess = useCallback((guessName) => {
    setGameState((prev) => {
      if (prev.status !== 'playing') return prev

      const correct   = guessName.toLowerCase() === prev.card.name.toLowerCase()
      const newGuesses = [...prev.guesses, { value: guessName, correct }]
      const newHints   = correct ? prev.hintsRevealed : Math.min(prev.hintsRevealed + 1, 3)
      const lost       = !correct && newGuesses.length >= MAX_GUESSES
      const status     = correct ? 'won' : lost ? 'lost' : 'playing'

      if (status === 'won') setStreak((s) => s + 1)
      if (status === 'lost') setStreak(0)

      return { ...prev, guesses: newGuesses, hintsRevealed: newHints, status }
    })
  }, [])

  const newGame = useCallback(() => {
    setGameState((prev) => initialPlayState(pickRandomCard(variant, prev.card.name)))
  }, [variant])

  const advanceRound = useCallback(() => {
    if (nextVariant) switchMode('daily', nextVariant)
  }, [nextVariant, switchMode])

  return {
    mode, variant, streak,
    switchMode, submitGuess, newGame, advanceRound,
    gameState, campaign,
    nextVariant, allRoundsComplete,
    maxGuesses: MAX_GUESSES,
  }
}
