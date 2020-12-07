const Game = require('../classes/game');
const Deck = require('../classes/deck');
const GamePlayer = require('../classes/game_player');
const { PlayerActions } = require('../utils/index');
const User = require('../classes/user');

const MAX_NUM_PLAYER_IN_GAME = 4;

const findAll = async (_, res) => {
  Game.findAll()
    .then((game) => {
      return res.send({ game });
    })
    .catch((err) => {
      return res.send({ error: err.message });
    });
};

const createOrJoin = async (req, res) => {
  const io = req.app.get('io');
  /* 
    - we fetch all available games with < max num of players.
    - If there is a game with < max num of players: join the game
    - else: create a game and wait until a new player joins to start the game.
    */
  console.log('CREATEORJOINREQUEST: ', req.user);
  const { id } = req.user;
  let gameIdToJoin;
  let allGamesFull = true;
  let newGame;

  GamePlayer.findAllGamesNotParticipating(id).then(async (games) => {
    if (games.length === 0) {
      console.log('No games yet, make a deck, game and gameplayer');
      allGamesFull = false;
      try {
        Deck.createNewDeck().then((deck) => {
          newGame = new Game(undefined, deck.id, 0);
          newGame
            .save()
            .then((game) => {
              const gamePlayer = new GamePlayer(undefined, game.id, id);
              gamePlayer.save();
              // eslint-disable-next-line func-names
              setTimeout(function () {
                io.to(req.session.passport.user.socket).emit('join game', {
                  game_id: game.id,
                });
              }, 3000);
              return res.send(game);
            })
            .catch((error) => {
              console.log(error);
              return res.status(422).send({ error: 'Game creation failure.' });
            });
        });
      } catch (e) {
        res.send({ message: 'there was an error creating a game' });
      }
    } else {
      console.log('There are games, just make a game_player and join the game');
      for (const existingGame of games) {
        // eslint-disable-next-line
        const numOfPlayersInGame = await GamePlayer.getNumPlayersInGame(
          existingGame.id,
        );
        if (parseInt(numOfPlayersInGame.count) < MAX_NUM_PLAYER_IN_GAME) {
          console.log('NUM PLAYERS IS LESS THAN MAX, ADDING PLAYER TO GAME');
          gameIdToJoin = existingGame.id;
          const gamePlayer = new GamePlayer(undefined, gameIdToJoin, id);
          gamePlayer.save();
          allGamesFull = false;
          break;
        }
      }
      if (allGamesFull === true) {
        console.log('ALL GAMES ARE FULL MAKE A NEW ONE');
        allGamesFull = false;
        try {
          Deck.createNewDeck().then((deck) => {
            newGame = new Game(undefined, deck.id, 0);
            newGame
              .save()
              .then((game) => {
                const gamePlayer = new GamePlayer(undefined, game.id, id);
                gamePlayer.save();
                // eslint-disable-next-line func-names
                setTimeout(function () {
                  io.to(req.session.passport.user.socket).emit('join game', {
                    game_id: game.id,
                  });
                }, 3000);
                return res.send(game);
              })
              .catch((error) => {
                console.log(error);
                return res
                  .status(422)
                  .send({ error: 'Game creation failure.' });
              });
          });
        } catch (e) {
          res.send({ message: 'there was an error creating a game' });
        }
      } else {
        console.log('REDIRECTING TO GAME');
        // eslint-disable-next-line func-names
        setTimeout(function () {
          io.to(req.session.passport.user.socket).emit('join game', {
            game_id: gameIdToJoin,
          });
        }, 3000);
      }
    }
  });
};

const findById = async (req, res) => {
  const { id } = req.params;
  Game.findById(id)
    .then((results) => {
      if (!results) {
        return res.status(400).send({ error: 'No game found' });
      }
      return res.send(results);
    })
    .catch((err) => {
      return res.status(400).send({ error: err.message });
    });
};

const update = async (req, res) => {
  const { id } = req.params;
  const { id_deck } = req.body;
  const { game_pot } = req.body;
  const { min_bet } = req.body;
  const { game_round } = req.body;
  const { curr_game_player_id } = req.body;

  Game.updateGame(
    id,
    id_deck,
    game_pot,
    min_bet,
    game_round,
    curr_game_player_id,
  )
    .then(() => {
      return res.send({ message: 'Game has been updated successfully' });
    })
    .catch(() => {
      return res.status(400).send({ error: 'No game found' });
    });
};

const deleteGame = async (req, res) => {
  const { id } = req.params;

  Game.delete(id)
    .then(() => {
      return res.send({ message: 'Game has been deleted successfully' });
    })
    .catch(() => {
      return res.status(400).send({ error: 'No game found' });
    });
};

const playerFold = async (req, res) => {
  const { id_user } = req.body;
  const { game_id } = req.params;

  GamePlayer.setPlayertoFold(id_user, game_id)
    .then(() => {
      return res.send({ message: 'Game_player has been updated successfully' });
    })
    .catch(() => {
      return res.status(400).send({ error: 'No game_player found' });
    });
};

const leaveGame = async (req, res) => {
  const { game_id } = req.params;
  const { id_user } = req.body;

  GamePlayer.removePlayer(id_user, game_id)
    .then(() => {
      return res.send({ message: 'Game_player has been removed successfully' });
    })
    .catch(() => {
      return res.status(400).send({ error: 'No game_player found' });
    });
};

const changeRound = async (req, res) => {
  const { game_id } = req.params;

  Game.getGameRound(game_id)
    .then((results) => {
      if (results === 9) {
        Game.updateGameRound(game_id, 1);
      } else {
        Game.updateGameRound(game_id, results + 1);
      }
    })
    .then(() => {
      return res.send({
        message: 'Game game_round has been updated successfully',
      });
    })
    .catch(() => {
      return res.status(400).send({ error: 'No game found' });
    });
};

const actionHandler = async (req) => {
  const { game_id, game_action } = req.params;
  const { user } = req;
  const action_amount = req.body.amount;
  const i_action_amount = parseInt(action_amount);

  // eslint-disable-next-line
  const userSocket = req.session.passport.user.socket;

  const io = req.app.get('io');

  /*
   *this is the main action handler
   * Each case should emit a socket action to the player making the action,
   *the entire board, or both
   */

  console.log('game_action => ', game_action);
  // eslint-disable-next-line
  switch (game_action) {
    case PlayerActions.CHECK:
      // literally nothing happens, signify in user game window by greying
      // out actions for that 'turn'?
      console.log('check called');
      io.to(userSocket).emit('msg', 'Checked.');
      break;
    case PlayerActions.BET:
      {
        // we need to get the users money, validate bet
        // if validated then we can remove the money from the user
        // finally we can then add that amount to the game pot
        console.log('bet called');
        const user_money = await User.getMoneyById(user.id);
        const min_bid = await Game.getMinBet(game_id);
        console.log(parseInt(Object.values(min_bid)));
        console.log(parseInt(Object.values(user_money)));
        console.log(parseInt(action_amount));
        const i_user_money = parseInt(Object.values(user_money));
        const i_min_bid = parseInt(Object.values(min_bid));
        if (i_user_money >= i_action_amount && i_action_amount >= i_min_bid) {
          const new_value = i_user_money - i_action_amount;
          console.log('new value =>', new_value);
          await User.updateMoneyById(user.id, new_value);
          const gamePot = await Game.getGamePot(game_id);
          const i_game_pot = parseInt(Object.values(gamePot));
          await Game.updateGamePot(game_id, i_game_pot + i_action_amount);
          await Game.updateMinBet(game_id, i_action_amount);
          io.to(userSocket).emit('user update', new_value);
          io.to(game_id).emit(
            'game update',
            i_action_amount,
            i_game_pot + i_action_amount,
          );
        } else if (i_action_amount < i_min_bid) {
          console.log('Bid not big enough');
          io.to(userSocket).emit('msg', 'Bid not big enough');
        } else {
          console.log('User does not have enough money');
          io.to(userSocket).emit('msg', 'not enough money');
        }
      }
      break;
    case PlayerActions.CALL:
      {
        // we need to get the users money, validate bet
        // if validated then we can remove the money from the user
        // finally we can then add that amount to the game pot
        console.log('call called');
        const user_money = await User.getMoneyById(user.id);
        const min_bid = await Game.getMinBet(game_id);
        const i_user_money = parseInt(Object.values(user_money));
        const i_min_bid = parseInt(Object.values(min_bid));
        console.log(parseInt(Object.values(min_bid)));
        console.log(Object.values(user_money) >= Object.values(min_bid));
        if (i_user_money >= i_min_bid) {
          const new_value = i_user_money - i_min_bid;
          console.log('new value =>', new_value);
          await User.updateMoneyById(user.id, new_value);
          const gamePot = await Game.getGamePot(game_id);
          const i_game_pot = parseInt(Object.values(gamePot));
          await Game.updateGamePot(game_id, i_game_pot + i_min_bid);
          io.to(userSocket).emit('user update', new_value);
          io.to(game_id).emit('game update', i_min_bid, i_game_pot + i_min_bid);
        } else {
          console.log('User does not have enough money');
          io.to(userSocket).emit('msg', 'not enough money');
        }
      }
      break;
    case PlayerActions.RAISE:
      {
        // we need to get the users money, validate bet
        // if validated then we can remove the money from the user
        // finally we can then add that amount to the game pot
        console.log('raise called');
        console.log(i_action_amount);
        console.log(i_action_amount === 0);
        const user_money = await User.getMoneyById(user.id);
        const min_bid = await Game.getMinBet(game_id);
        const i_user_money = parseInt(Object.values(user_money));
        const i_min_bid = parseInt(Object.values(min_bid));
        console.log(parseInt(Object.values(min_bid)));
        if (
          i_user_money >= i_action_amount + i_min_bid &&
          i_action_amount !== 0
        ) {
          const new_value = i_user_money - i_action_amount - i_min_bid;
          console.log('new value =>', new_value);
          await User.updateMoneyById(user.id, new_value);
          const gamePot = await Game.getGamePot(game_id);
          const i_game_pot = parseInt(Object.values(gamePot));
          await Game.updateGamePot(
            game_id,
            i_game_pot + i_action_amount + i_min_bid,
          );
          await Game.updateMinBet(game_id, i_action_amount + i_min_bid);
          io.to(userSocket).emit('user update', new_value);
          io.to(game_id).emit(
            'game update',
            i_action_amount + i_min_bid,
            i_game_pot + i_action_amount + i_min_bid,
          );
        } else if (i_action_amount === 0) {
          console.log('Thats not a raise, just call instead');
          io.to(userSocket).emit('msg', 'Thats not a raise, just call instead');
        } else {
          console.log('User does not have enough money');
          io.to(userSocket).emit('msg', 'not enough money');
        }
      }
      break;
    case PlayerActions.FOLD:
      console.log('EMITTING TESTING TO GAME_ID => ', game_id);
      io.to(game_id).emit('testing');
      io.to(userSocket).emit('msg', 'Folded');
      break;
    case PlayerActions.RESET:
      {
        await Game.updateGamePot(game_id, 0);
        await Game.updateMinBet(game_id, 0);
        await User.updateMoneyById(user.id, 1000);
        const user_money = await User.getMoneyById(user.id);
        const min_bid = await Game.getMinBet(game_id);
        const i_user_money = parseInt(Object.values(user_money));
        const i_min_bid = parseInt(Object.values(min_bid));
        const gamePot = await Game.getGamePot(game_id);
        const i_game_pot = parseInt(Object.values(gamePot));
        io.to(userSocket).emit('user update', i_user_money);
        io.to(game_id).emit('game update', i_min_bid, i_game_pot);
      }
      break;
    case PlayerActions.LEAVE:
      console.log('should be leaving game');
      await GamePlayer.removePlayer(user.id, game_id);
      io.to(userSocket).emit('leave game');
      return;
  }
  // list of game actions
  /*
   * reset minimum bet - also reset ui components etc
   * check for minimum bet at all, set ui accordingly
   *
   */
  console.log('hello world');
  /*
   * after handling the player actions, here is where we send events
   * back to the entire table,
   * i.e if last player in river, calculate winner and display
   * winner of round, gather all cards, distrubute cards etc.
   * these should all be throguh sockets
   */
  // return res.send('hello world');
};

module.exports = {
  createOrJoin,
  findAll,
  findById,
  update,
  deleteGame,
  playerFold,
  leaveGame,
  changeRound,
  actionHandler,
};
