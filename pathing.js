module.exports = function (s, a, b, fn, maxLength) {
    if (!fn) fn = defaultHeuristic;
    if (!maxLength) maxLength = Infinity;
    return run(s, a, b, fn, maxLength);
};

function run(s, a, b, fn, maxLength) {
    var open, map, i, len, best, bestEx, tile, tileEx;
    var neighbours, neighbour, g;

    if (a === b) return [];

    open = [a];
    map = Object.create(null);
    map[a.idx] = new TileEx('open', 0, fn(s, a, b, a));

    while ((len = open.length)) {
        best = bestEx = null;
        for (i = 0; i < len; i++) {
            tile = open[i];
            tileEx = map[tile.idx];
            if (!best || tileEx.f < bestEx.f) {
                best = tile;
                bestEx = tileEx;
                bestEx.i = i;
            }
        }

        if (best === b)
            return reconstruct();

        bestEx.mark = 'closed';
        open.splice(bestEx.i, 1);

        if (bestEx.g === maxLength) continue;
        g = bestEx.g + 1;

        neighbours = best.neighbours();
        len = neighbours.length;
        for (i = 0; i < len; i++) {
            neighbour = neighbours[i];

            tile = neighbour.tile;
            if (!tile || (tile !== b && tile.chr !== '  ')) continue;

            tileEx = map[tile.idx];
            if (!tileEx) {
                tileEx = map[tile.idx] = new TileEx('new', 0, 0);
                open.push(tile);
            }
            else if (tileEx.mark === 'closed' || g >= tileEx.g) {
                continue;
            }

            tileEx.prev = best;
            tileEx.dir = neighbour.dir;
            tileEx.g = g;
            tileEx.f = g + fn(s, tile, b, best);
        }
    }

    return null;

    function reconstruct() {
        var path = [];
        var tile = b;
        while (true) {
            var tileEx = map[tile.idx];

            var dir = tileEx.dir;
            if (!dir) break;
            path.unshift(dir);

            tile = tileEx.prev;
        }
        return path;
    }
}

// We use a class for this, and keep all properties
// of the same type, to optimize for V8.
function TileEx(open, g, f) {
    this.open = open;
    this.g = g;
    this.f = f;

    this.i = 0;
    this.prev = null;
    this.dir = '';
}

// Default heuristic is to simply get closest to the goal.
function defaultHeuristic(s, tile, goal, from) {
    return tile.dist(goal);
}
