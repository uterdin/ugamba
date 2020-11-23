const db = require('../db');

const getCardById = (id) => {
  return db.one('SELECT * FROM card WHERE id = $1', [id]);
};

const getDeckCardById = (id) => {
  return db.one('SELECT * FROM deck_card WHERE id = $1', [id]);
};

const createNewDeck = () => {
  return db.one('INSERT INTO deck DEFAULT VALUES RETURNING id');
};

const assignDeckToGame = (deckId, gameId) => {
  return db.none('UPDATE game SET id_deck = $1 WHERE id = $2', [
    deckId,
    gameId,
  ]);
};

const createDeckCard = (cardId, deckId) => {
  return db.none('INSERT INTO deck_card(id_card,id_deck) VALUES($1,$2)', [
    cardId,
    deckId,
  ]);
};

const getDeckByGameId = (gameId) => {
  return db.one('SELECT * FROM game WHERE id = $1', [gameId]);
};

const getAllCardsInDeck = (deckId) => {
  return db.many('SELECT * FROM deck_card WHERE id_deck = $1', [deckId]);
};

const getAllUnownedCardsInDeck = (deckId) => {
  // eslint-disable-next-line no-console
  console.log(`deckId=${deckId}`);
  return db.many(
    'SELECT * FROM deck_card WHERE id_deck = $1 AND id_game_player_hand IS NULL',
    [deckId],
  );
};

const getAllOwnedCardsInDeck = (deckId) => {
  return db.many(
    'SELECT * FROM deck_card WHERE id_deck = $1 AND id_game_player_hand IS NOT NULL',
    [deckId],
  );
};

const assignDeckCardToPlayerHand = (cardId, playerHandId) => {
  return db.none(
    'UPDATE deck_card SET id_game_player_hand = $1 WHERE id = $2',
    [playerHandId, cardId],
  );
};

module.exports = {
  getCardById,
  getDeckCardById,
  createNewDeck,
  assignDeckToGame,
  createDeckCard,
  getDeckByGameId,
  getAllCardsInDeck,
  getAllUnownedCardsInDeck,
  getAllOwnedCardsInDeck,
  assignDeckCardToPlayerHand,
};