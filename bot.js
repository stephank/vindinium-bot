#!/usr/bin/env node

var printf = require('printf');
var Board = require('./board');
var pathing = require('./pathing');

// Decide on next turn.
module.exports = function bot(s, cb) {
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
    function goal(action, tile, path, score) {
        if (best && best.score >= score) return;
        best = { action: action, tile: tile, path: path, score: score };
    }

    // How badly we want to heal, or dodge towards a tavern.
    var shouldRun = hero.mineCount && tileDanger(s, hero.tile, 0);
    var shouldHeal = hero.life <= 80 && (hero.gold >= 2 || hero.mineCount);
    if (shouldRun || shouldHeal) {
        board.taverns.forEach(function(tile) {
            var path = pathing(s, s.hero.tile, tile, tileCost);
            if (path)
                goal('heal', tile, path,
                    (shouldRun ? 100 : 80 - hero.life) - path.length);
        });
    }

    if (hero.life > 20) {
        // How important are the mines.
        board.mines.forEach(function(tile) {
            // If it's ours, never mind.
            if (tile.chr[1] === hero.idStr) return;

            var path = pathing(s, s.hero.tile, tile, tileCost);
            if (path) {
                goal('mine', tile, path,
                    Math.max(11 - path.length, 1) * 4);
            }
        });

        // Look for kill opportunities.
        s.game.heroes.forEach(function(douche) {
            // Let's not stab ourselves.
            if (douche === hero) return;
            // Don't bother unless we have something to gain.
            if (douche.mineCount < 2) return;
            // If we'll lose, never mind.
            if (douche.life > hero.life) return;

            var path = pathing(s, s.hero.tile, douche.tile, tileCost);
            if (path) {
                // If the path length is uneven, consider the first hit.
                if (path.length % 2 === 1 &&
                    douche.life > hero.life - 20) return;

                goal('kill', douche.tile, path,
                    Math.max(11 - path.length, 0) * 5);
            }
        });
    }

    // Execute best goal.
    s.context.goal = best;
    if (best)
        cb(best.path[0]);
    else
        cb(null);
}

// Check for a nearby danger from enemies.
function tileDanger(s, tile, lifePenalty) {
    var hero = s.hero;
    var heroLife = hero.life - lifePenalty - tile.isNear('@') * 20;
    if (tile.isNear('[]')) heroLife += 20;

    var res = 0;
    s.game.heroes.forEach(function(douche) {
        if (douche === s.hero) return;

        // Find douches that have potential to hunt us.
        var path = pathing(s, douche.tile, tile, null, 3);
        if (path) {
            var dist = path.length;

            // Never fight an enemy next to a tavern.
            if (dist === 1 && douche.tile.isNear('[]')) {
                res += 5;
            }
            // Keep a safe distance from healthier douches.
            else if (dist < 4) {
                var safeLife = heroLife;
                if (path.length % 2 === 1) safeLife -= 20;
                if (douche.life > safeLife)
                    res += Math.max(res, 4 - dist);
            }
        }
    });
    return res;
}

// Heuristic cost calculation during pathing.
// Avoid dangerous tiles, and get the closest to the goal.
function tileCost(s, tile, goal, from) {
    var nextTile = (tile.chr === '  ') ? tile : from;
    var lifePenalty = (tile.chr[0] === '$') ? 20 : 0;
    return tile.dist(goal) + tileDanger(s, nextTile, lifePenalty) * 50;
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
    require('vindinium-client').cli(module.exports, function(s) {
        var turn = Math.floor(s.game.turn / 4);
        var goal = s.context.goal;
        var hero = s.hero;
        var str;

        if (turn === 0) {
            str = printf('### Game started - URL: %s', s.viewUrl);
        }

        else if (s.game.finished) {
            var topScore = -1;
            var topRankers = 0;

            str = '### Game ended - ';

            var ranking = s.game.heroes.slice();
            ranking.sort(function(a, b) {
                return b.gold - a.gold;
            });

            if (s.hero.gold === ranking[0].gold) {
                if (ranking[0].gold === ranking[1].gold)
                    str += 'DRAW';
                else
                    str += 'WIN';
            }
            else {
                str += 'LOSS';
            }

            str += ' - ' + ranking.map(function(douche) {
                return printf('P%d %s: %d ◯',
                    douche.id, douche.name, douche.gold);
            }).join(', ');
        }

        else {
            str = printf('T=%3d - Hero: %3d ♡, %4d ◯, (%2d,%2d) - ',
                turn, hero.life, hero.gold, hero.pos.x, hero.pos.y);

            if (goal)
                str += printf('Goal: %5s, (%2d,%2d) %4d #',
                    goal.action, goal.tile.x, goal.tile.y, goal.score);
            else
                str += 'Goal: idle                 ';

            str += printf(' - %4d ms', s.context.ms);
        }

        console.log(str);
    });
}
