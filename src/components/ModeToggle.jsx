export default function ModeToggle({ mode, variant, onSwitch }) {
  return (
    <div className="mode-toggle-wrap">
      <div className="mode-toggle">
        <button
          className={mode === 'daily' ? 'active' : ''}
          onClick={() => onSwitch('daily', variant)}
        >
          Daily
        </button>
        <button
          className={mode === 'infinite' ? 'active' : ''}
          onClick={() => onSwitch('infinite', variant)}
        >
          Infinite
        </button>
      </div>
      <div className="mode-toggle variant-toggle">
        <button
          className={variant === 'normal' ? 'active' : ''}
          onClick={() => onSwitch(mode, 'normal')}
        >
          Oracle
        </button>
        <button
          className={variant === 'bonus' ? 'active bonus' : 'bonus'}
          onClick={() => onSwitch(mode, 'bonus')}
        >
          Flavor ✦
        </button>
        <button
          className={variant === 'wildcard' ? 'active wildcard' : 'wildcard'}
          onClick={() => onSwitch(mode, 'wildcard')}
        >
          Wildcard 🃏
        </button>
      </div>
    </div>
  )
}
