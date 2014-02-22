#!/usr/bin/env node

var Board = require('./board');
var pathing = require('./pathing');

// Decide on next turn.
module.exports = function(s, cb) {
    augment(s);

    // Find the furthest tavern.
    var ctx = s.context;
    if (!ctx.path) {
        var board = s.game.board;
        var heroTile = s.hero.tile;

        var best;
        var bestDist = 0;
        board.findAll('[]').forEach(function(tile) {
            var d = tile.dist(heroTile);
            if (d > bestDist) {
                best = tile;
                bestDist = d;
            }
        });

        ctx.path = pathing(s, heroTile, best);
    }

    // Move along path.
    var dir = ctx.path[0];
    if (s.hero.tile[dir]().chr[0] === ' ')
        ctx.path.shift();
    else
        dir = null;
    cb(dir);
};

// Do a bunch of augmentations on game state.
function augment(s) {
    var board = s.game.board = new Board(s.game.board);

    s.game.heroes.concat([s.hero]).forEach(function(hero) {
        var pos = hero.pos;
        hero.tile = board.get(pos.x, pos.y);
    });
}

// Run CLI if main.
if (require.main === module)
    require('./client').cli(module.exports);
