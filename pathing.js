var DIRS = ['n', 'e', 's', 'w'];
module.exports = function(s, a, b) {
    var tiles, open, i, len, best, tile, dir;

    tiles = s.game.board.tiles;
    len = tiles.length;
    for (i = 0; i < len; i++)
        tiles[i]._closed = false;

    open = [a];
    a._g = 0;
    a._f = a.dist(b);

    while ((len = open.length)) {
        best = null;
        for (i = 0; i < len; i++) {
            tile = open[i];

            if (!best) best = tile;
            else if (tile._f < best._f) best = tile;
        }

        if (best === b)
            return reconstruct();

        best._closed = true;
        open.splice(open.indexOf(best), 1);

        for (i = 0; i < 4; i++) {
            dir = DIRS[i];

            tile = best[dir]();
            if (!tile || tile._closed ||
                !(tile === b || tile.chr[0] === ' ' ||
                                tile.chr[0] === '@')) continue;

            g = best._g + 1;
            if (open.indexOf(tile) === -1)
                open.push(tile);
            else if (g >= tile._g)
                continue;

            tile._prev = best;
            tile._dir = dir;
            tile._g = g;
            tile._f = g + tile.dist(b);
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
