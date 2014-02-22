module.exports = function(s, a, b, fn) {
    var tiles, open, i, len, best, tile, neighbours;

    if (a === b) return [];
    if (!fn) fn = defaultHeuristic;

    tiles = s.game.board.tiles;
    len = tiles.length;
    for (i = 0; i < len; i++)
        tiles[i]._closed = false;

    open = [a];
    a._g = 0;
    a._f = fn(s, a, b);

    while ((len = open.length)) {
        best = null;
        for (i = 0; i < len; i++) {
            tile = open[i];
            if (!best || tile._f < best._f) best = tile;
        }

        if (best === b)
            return reconstruct();

        best._closed = true;
        open.splice(open.indexOf(best), 1);

        neighbours = best.neighbours();
        len = neighbours.length;
        for (i = 0; i < len; i++) {
            tile = neighbours[i];
            if (tile._closed || !(tile === b || tile.chr === '  '))
                continue;

            g = best._g + 1;
            if (open.indexOf(tile) === -1)
                open.push(tile);
            else if (g >= tile._g)
                continue;

            tile._prev = best;
            tile._dir = tile.dir;
            tile._g = g;
            tile._f = g + fn(s, tile, b);
        }
    }

    function reconstruct() {
        var path = [];
        tile = b;
        while ((dir = tile._dir)) {
            path.unshift(dir);
            tile = tile._prev;
        }
        return path;
    }
};

function defaultHeuristic(s, a, b) {
    return a.dist(b);
}
