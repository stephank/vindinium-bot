module.exports = function(s, a, b, fn, maxLength) {
    var open, map, i, len, best, bestEx, tile, tileEx;
    var neighbours, neighbour, g;

    if (a === b) return [];
    if (!fn) fn = defaultHeuristic;
    if (!maxLength) maxLength = Infinity;

    open = [a];
    map = Object.create(null);
    map[a.idx] = { open: true, g: 0, f: fn(s, a, b) };

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

        bestEx.open = false;
        open.splice(bestEx.i, 1);

        if (bestEx.g === maxLength) continue;

        neighbours = best.neighbours();
        len = neighbours.length;
        for (i = 0; i < len; i++) {
            neighbour = neighbours[i];

            tile = neighbour.tile;
            if (!tile || (tile !== b && tile.chr !== '  ')) continue;

            tileEx = map[tile.idx];
            if (!tileEx) tileEx = map[tile.idx] = {};
            else if (tileEx.open === false) continue;

            g = bestEx.g + 1;
            if (!tileEx.open) {
                tileEx.open = true;
                open.push(tile);
            }
            else if (g >= tileEx.g) {
                continue;
            }

            tileEx.prev = best;
            tileEx.dir = neighbour.dir;
            tileEx.g = g;
            tileEx.f = g + fn(s, tile, b);
        }
    }

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
};

function defaultHeuristic(s, a, b) {
    return a.dist(b);
}
