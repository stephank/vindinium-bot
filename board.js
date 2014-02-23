// Note: coordinates are flipped

var Board = function(data) {
    var size = this.size = data.size;
    var numTiles = this.numTiles = size * size;
    var tiles = this.tiles = new Array(numTiles);

    var mines = this.mines = [];
    var taverns = this.taverns = [];

    var x = 0, y = 0;
    var str = this.str = data.tiles;
    for (var idx = 0; idx < numTiles; idx++) {
        var strIdx = idx * 2;
        var chr = str.slice(strIdx, strIdx + 2);
        var tile = tiles[idx] = new Tile(this, idx, x, y, chr);

        if (chr[0] === '$')
            mines.push(tile);
        else if (chr === '[]')
            taverns.push(tile);

        if (++y >= size) {
            y = 0;
            x++;
        }
    }
};
var BoardProto = Board.prototype;

BoardProto.get = function(x, y) {
    var size = this.size;
    if (x < 0 || x >= size) return null;
    if (y < 0 || y >= size) return null;
    return this.tiles[x * size + y];
};

BoardProto.findOne = function(t) {
    return this.tiles.find(function(tile) {
        return tile.chr === t;
    });
};

BoardProto.findAll = function(t) {
    return this.tiles.filter(function(tile) {
        if (tile.chr[0] === t[0])
            return !t[1] || tile.chr[1] === t[1];
    });
};

BoardProto.toString = function() {
    var s = '';
    var orig = this.str;
    var len = orig.length;
    var stride = this.size * 2;
    for (i = 0; i < len; i += stride)
        s += orig.slice(i, i + stride) + '\n';
    return s;
};


var Tile = function(board, idx, x, y, chr) {
    this.board = board;
    this.idx = idx;
    this.x = x;
    this.y = y;
    this.chr = chr;
};
var TileProto = Tile.prototype;

TileProto.n = function() {
    return this.board.get(this.x - 1, this.y);
};

TileProto.e = function() {
    return this.board.get(this.x, this.y + 1);
};

TileProto.s = function() {
    return this.board.get(this.x + 1, this.y);
};

TileProto.w = function() {
    return this.board.get(this.x, this.y - 1);
};

TileProto.dist = function(other) {
    return Math.abs(other.x - this.x) + Math.abs(other.y - this.y);
};

TileProto.neighbours = function() {
    return [
        { dir: 'n', tile: this.n() },
        { dir: 'e', tile: this.e() },
        { dir: 's', tile: this.s() },
        { dir: 'w', tile: this.w() }
    ];
};

TileProto.isNear = function(t) {
    return this.neighbours().some(function(neighbour) {
        var tile = neighbour.tile;
        if (tile && tile.chr[0] === t[0])
            return !t[1] || tile.chr[1] === t[1];
    });
};


module.exports = Board;
