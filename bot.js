#!/usr/bin/env node

var printf = require('printf');
var Board = require('./board');
var pathing = require('./pathing');

// Decide on next turn.
module.exports = function entry(s, cb) {
    var start = Date.now();
    run(s, function(dir) {
        s.context.ms = Date.now() - start;
        cb(dir);
    });
};

function run(s, cb) {
    augment(s);

    var hero = s.hero;
    var board = s.game.board;

    var best = null;
    function goal(action, tile, score) {
        if (best && best.score >= score) return;
        best = { action: action, tile: tile, score: score };
    }

    // How badly we want to heal.
    if (hero.life <= 80 && (hero.gold >= 2 || hero.mineCount)) {
        var tavern;
        board.taverns.forEach(function(tile) {
            var path = pathing(s, s.hero.tile, tile);
            if (path) {
                if (!tavern || tile._dist < tavern._dist) tavern = tile;
            }
        });
        goal('heal', tavern, 80 - hero.life);
    }

    if (hero.life > 20) {
        // How important are the mines.
        board.mines.forEach(function(tile) {
            // If it's ours, never mind.
            if (tile.chr[1] === hero.idStr) return;

            var path = pathing(s, s.hero.tile, tile);
            if (path) {
                goal('mine', tile, Math.max(11 - path.length, 1) * 10);
            }
        });

        // Look for kill opportunities.
        s.game.heroes.forEach(function(douche) {
            // Let's not stab ourselves.
            if (douche === hero) return;
            // Don't bother unless we have something to gain.
            if (douche.mineCount === 0) return;
            // If we'll lose, never mind.
            if (douche.life > hero.life) return;

            var path = pathing(s, s.hero.tile, douche.tile);
            if (path) {
                goal('kill', douche.tile,
                    Math.max(11 - path.length, 0) * 8);
            }
        });
    }

    // Execute best goal.
    s.context.goal = best;
    if (best) {
        var path = pathing(s, hero.tile, best.tile);
        cb(path[0]);
    }
    else {
        cb(null);
    }
}

// Do a bunch of augmentations on game state.
function augment(s) {
    var board = s.game.board = new Board(s.game.board);

    s.game.heroes.forEach(function(douche) {
        if (douche.id === s.hero.id)
            s.hero = douche;

        var idStr = String(douche.id);
        douche.idStr = idStr;

        var pos = douche.pos;
        douche.tile = board.get(pos.x, pos.y);

        var spawnPos = douche.spawnPos;
        douche.spawnTile = board.get(spawnPos.x, spawnPos.y);

        douche.mines = board.mines.filter(function(tile) {
            return tile.chr[1] === douche.idStr;
        });
    });
}

// Run CLI if main.
if (require.main === module) {
    require('./client').cli(module.exports, function(s) {
        var turn = Math.floor(s.game.turn / 4);
        var goal = s.context.goal;
        var hero = s.hero;
        var str;

        if (turn === 0) {
            str = printf("### Game started - URL: %s", s.viewUrl);
        }

        else if (s.game.finished) {
            var topScore = -1;
            var topRankers = 0;

            var ranking = s.game.heroes.map(function(douche) {
                if (douche.gold > topScore) {
                    topScore = douche.gold;
                    topRankers = 1;
                }
                else if (douche.gold === topScore) {
                    topRankers++;
                }

                return printf("P%d %s: %d ◯",
                    douche.id, douche.name, douche.gold);
            }).join(', ');

            if (hero.gold === topScore) {
                if (topRankers > 1)
                    str = 'DRAW';
                else
                    str = 'WIN';
            }
            else {
                str = 'LOSS';
            }

            str = printf("### Game ended - %s - %s", str, ranking);
        }

        else {
            str = printf('T=%4d - Hero: %3d ♡, %4d ◯, (%2d,%2d) - ',
                turn, hero.life, hero.gold, hero.pos.x, hero.pos.y);

            if (goal)
                str += printf('Goal: %4s, (%2d,%2d) %4d #',
                    goal.action, goal.tile.x, goal.tile.y, goal.score);
            else
                str += 'Goal: idle                ';

            str += printf(' - %4d ms', s.context.ms);
        }

        console.log(str);
    });
}
