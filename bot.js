#!/usr/bin/env node

var util = require('util');
var Board = require('./board');
var pathing = require('./pathing');

// Decide on next turn.
module.exports = function(s, cb) {
    augment(s);

    var hero = s.hero;
    var board = s.game.board;
    var goals = [];

    // How badly we want to heal.
    var best = null;
    if (hero.mineCount && hero.life <= 80) {
        board.taverns.forEach(function(tile) {
            tile._dist = tile.dist(hero.tile);
            if (!best || tile._dist < best._dist) best = tile;
        });
        goals.push({ what: 'heal', where: best, score:
            (80 - hero.life) * 3
        });
    }

    if (hero.life > 20) {
        // How important are the mines.
        board.mines.forEach(function(tile) {
            // If it's ours, never mind.
            if (tile.chr[1] === hero.idStr) return;

            goals.push({ what: 'mine', where: tile, score:
                Math.max(10 - tile.spawnDist, 1) / Math.max(hero.mineCount, 1) * 50
            });
        });

        // Look for kill opportunities.
        s.game.heroes.forEach(function(douche) {
            // Let's not stab ourselves.
            if (douche.id === hero.id) return;
            // If we'll lose, never mind.
            if (douche.life > hero.life) return;

            var dist = douche.tile.dist(hero.tile);
            goals.push({ what: 'kill', where: douche.tile, score:
                douche.mineCount * Math.max(5 - dist, 0) * 40
            });
        });
    }

    // Determine best goal.
    best = null;
    goals.forEach(function(goal) {
        if (!best || goal.score > best.score) best = goal;
    });
    s.context.goal = best;

    // Execute.
    if (best) {
        var path = pathing(s, hero.tile, best.where);
        cb(path[0]);
    }
    else {
        cb(null);
    }
};

// Do a bunch of augmentations on game state.
function augment(s) {
    var board = s.game.board = new Board(s.game.board);

    s.game.heroes.concat([s.hero]).forEach(function(hero) {
        var idStr = String(hero.id);
        hero.idStr = idStr;

        var pos = hero.pos;
        hero.tile = board.get(pos.x, pos.y);

        var spawnPos = hero.spawnPos;
        hero.spawnTile = board.get(spawnPos.x, spawnPos.y);

        hero.mines = board.mines.filter(function(tile) {
            return tile.chr[1] === hero.idStr;
        });
    });

    if (!s.context.mineDist) {
        s.context.mineDist = board.mines.map(function(tile) {
            var path = pathing(s, s.hero.tile, tile);
            return (tile.spawnDist = path ? path.length : Infinity);
        });
    }
    else {
        s.context.mineDist.forEach(function(spawnDist, i) {
            board.mines[i].spawnDist = spawnDist;
        });
    }
}

// Run CLI if main.
if (require.main === module) {
    require('./client').cli(module.exports, function(s) {
        var turn = Math.floor(s.game.turn / 4);
        var goal = s.context.goal;
        var hero = s.hero;

        str = util.format('T=%s - ', turn);
        if (turn === 0) {
            str += util.format('Game started: %s', s.viewUrl);
        }
        else {
            str += util.format('Hero: ♡ %s, ◯ %s, (%s,%s) - ',
                hero.life, hero.gold, hero.pos.x, hero.pos.y);
            if (goal)
                str += util.format('Goal: %s, (%s,%s) # %s',
                    goal.what, goal.where.x, goal.where.y, goal.score);
            else
                trs += 'Goal: idle';
        }

        console.log(str);
    });
}
