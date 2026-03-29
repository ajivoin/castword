import { useState, useRef, useEffect } from 'react'
import cardNames from '../data/card-names.json'

const MAX_SUGGESTIONS = 8

export default function GuessInput({ onGuess, disabled, pastGuesses }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const pastSet = new Set(pastGuesses.filter((g) => !g.skipped).map((g) => g.value.toLowerCase()))

  useEffect(() => {
    if (!disabled) inputRef.current?.focus()
  }, [disabled])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    setActiveIdx(-1)
    if (val.trim().length < 2) {
      setSuggestions([])
      return
    }
    const lower = val.toLowerCase()
    const matches = cardNames
      .filter((n) => n.toLowerCase().includes(lower))
      .slice(0, MAX_SUGGESTIONS)
    setSuggestions(matches)
  }

  function commit(name) {
    if (!name || pastSet.has(name.toLowerCase())) return
    onGuess(name)
    setQuery('')
    setSuggestions([])
    setActiveIdx(-1)
  }

  function handleKeyDown(e) {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0]
      if (target) commit(target)
    } else if (e.key === 'Escape') {
      setSuggestions([])
      setActiveIdx(-1)
    }
  }

  // Scroll active suggestion into view
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const el = listRef.current.children[activeIdx]
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx])

  return (
    <div className="guess-input-wrap">
      <div className="guess-input-row">
        <input
          ref={inputRef}
          className="guess-input"
          type="text"
          placeholder="Search for a card…"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {suggestions.length > 0 && (
        <ul ref={listRef} className="suggestion-list" role="listbox">
          {suggestions.map((name, i) => (
            <li
              key={name}
              className={`suggestion-item${i === activeIdx ? ' active' : ''}${pastSet.has(name.toLowerCase()) ? ' used' : ''}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={() => commit(name)}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
