export const CARD_COUNTERSPELL = {
  name: 'Counterspell',
  oracle_id: 'oracle-001',
  scryfall_uri: 'https://scryfall.com/card/2ed/56',
  type_line: 'Instant',
  mana_cost: '{U}{U}',
  colors: ['U'],
  oracle_text: 'Counter target spell.',
  flavor_text: '"I have a better idea."',
  image_url: 'https://cards.scryfall.io/normal/front/a/0/a06a42b0-e.jpg',
  image_url_back: '',
  unique_words: ['counterspell'],
}

export const CARD_LIGHTNING_BOLT = {
  name: 'Lightning Bolt',
  oracle_id: 'oracle-002',
  scryfall_uri: 'https://scryfall.com/card/lea/161',
  type_line: 'Instant',
  mana_cost: '{R}',
  colors: ['R'],
  oracle_text: 'Lightning Bolt deals 3 damage to any target.',
  flavor_text: '',
  image_url: 'https://cards.scryfall.io/normal/front/l/b/lb0f-e.jpg',
  image_url_back: '',
  unique_words: ['bolt'],
}

export const CARD_POOL = [CARD_COUNTERSPELL, CARD_LIGHTNING_BOLT]

export function makeDailyGameState(card = CARD_COUNTERSPELL) {
  return {
    card,
    hintsRevealed: 0,
    guesses: [],
    status: 'playing',
  }
}
