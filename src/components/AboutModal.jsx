export default function AboutModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal about-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>About Castword</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <section className="about-section">
          <p className="about-intro">
            Each puzzle gives you a single word that appears on <strong>exactly one Magic: The Gathering card</strong>.
            Your goal is to figure out which card it is.
          </p>
        </section>

        <section className="about-section">
          <h3 className="about-heading">How to play</h3>
          <p className="about-text">You have <strong>5 guesses</strong>. After each wrong guess, a new clue is revealed:</p>
          <ol className="about-steps">
            <li><span className="about-step-num">1</span> The unique word — always shown first</li>
            <li><span className="about-step-num">2</span> Mana cost</li>
            <li><span className="about-step-num">3</span> Card type</li>
            <li><span className="about-step-num">4</span> Card text</li>
            <li><span className="about-step-num">5</span> Flavor text</li>
          </ol>
          <p className="about-text">
            Type any card name in the search box to make a guess. Hit <strong>Skip</strong> to reveal the next clue without
            using a guess, or <strong>Give Up</strong> on your last guess to see the answer.
          </p>
          <p className="about-note">
            The card's name is hidden wherever it appears in the text, so you can't just search for it.
          </p>
        </section>

        <section className="about-section">
          <h3 className="about-heading">Variants</h3>
          <div className="about-variants">
            <div className="about-variant">
              <span className="about-variant-label easy-label">Easy ★</span>
              <p>The unique word comes from a card's <em>rules text</em>. Cards are limited to popular, well-known cards — great for newer players.</p>
            </div>
            <div className="about-variant">
              <span className="about-variant-label">Oracle</span>
              <p>The unique word comes from a card's <em>rules text</em>. Cards are from mainline sets (no Un-sets).</p>
            </div>
            <div className="about-variant">
              <span className="about-variant-label bonus-label">Flavor ✦</span>
              <p>The unique word comes from a card's <em>flavor text</em> only — the word doesn't appear anywhere in the rules. Cards are from all paper sets.</p>
            </div>
            <div className="about-variant">
              <span className="about-variant-label wildcard-label">Wildcard 🃏</span>
              <p>The unique word can come from rules <em>or</em> flavor text. Includes Un-sets and joke cards.</p>
            </div>
          </div>
        </section>

        <section className="about-section">
          <h3 className="about-heading">Modes</h3>
          <div className="about-modes">
            <div className="about-mode">
              <strong>Daily</strong>
              <p>One puzzle per variant per day, the same card for everyone. Complete Oracle → Flavor → Wildcard in order to unlock a combined share of your results.</p>
            </div>
            <div className="about-mode">
              <strong>Infinite</strong>
              <p>Play as many puzzles as you want with a running streak. If you switch away mid-game, your card will be waiting when you come back.</p>
            </div>
          </div>
        </section>

        <section className="about-section about-footer">
          <p className="about-text">
            Card data from <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer">Scryfall</a>.
            Popularity data from <a href="https://edhrec.com" target="_blank" rel="noopener noreferrer">EDHRec</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
