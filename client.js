var fs = require('fs');
var request = require('request');

function gameRequest(url, form, cb) {
    request.post({ url: url, form: form }, function(err, res, body) {
        if (err)
            return cb(err);
        if (res.statusCode !== 200)
            return cb(new Error(res.statusCode + ' ' + body));

        try { body = JSON.parse(body); }
        catch (e) { return cb(e); }

        cb(null, body);
    });
}

function start(config, cb) {
    var bot = config.bot;
    var key = config.key;
    var mode = config.mode;
    var log = config.log;
    var context = config.context || {};
    var serverUrl = config.serverUrl || 'http://vindinium.org';

    if (typeof(bot) !== 'function')
        throw new Error("bot must be set");
    if (typeof(key) !== 'string')
        throw new Error("key must be set");
    if (mode !== 'arena' && mode !== 'training')
        throw new Error("mode must be set to arena or training");

    var state;
    if ('arena' === mode) {
        console.log('Connected and waiting for other players to join...');
    }

    gameRequest(serverUrl + '/api/' + mode, {
        key: key
    }, function(err, state) {
        if (err) cb(err); else loop(state);
    });

    function loop(state) {
        state.context = context;

        if (log) log(state);
        if (state.game.finished) return cb(null, state);

        var url = state.playUrl;
        bot(state, function(dir) {
            if (!dir) dir = '';
            switch (dir.toLowerCase()) {
                case 'n': case 'north':
                    dir = 'North'; break;
                case 'e': case 'east':
                    dir = 'East'; break;
                case 's': case 'south':
                    dir = 'South'; break;
                case 'w': case 'west':
                    dir = 'West'; break;
                default:
                    dir = 'Stay'; break;
            }

            gameRequest(state.playUrl, {
                key: key,
                dir: dir
            }, function(err, state) {
                if (err) cb(err); else loop(state);
            });
        });
    }
}

function cli(bot) {
    var argv = process.argv;
    var mode, numGames, cfgFile;
    if (argv[2] === '-a') {
        if (argv.length !== 5) usage();
        mode = 'arena';
        numGames = parseInt(argv[3], 10);
        cfgFile = argv[4];
    }
    else if (argv[2] === '-t') {
        if (argv.length !== 5) usage();
        mode = 'training';
        numGames = parseInt(argv[3], 10);
        cfgFile = argv[4];
    }
    else {
        usage();
    }

    var config;
    fs.readFile(cfgFile, 'utf8', function(err, data) {
        if (err) fatal('Failed to open config', err);

        try { config = JSON.parse(data); }
        catch (e) { fatal('Failed to parse config', e); }

        config.bot = bot;
        config.mode = mode;
        config.log = log;
        playGame();
    });

    var i = 0;
    function playGame() {
        start(config, function(err, state) {
            if (++i < numGames) playGame();
        });
    }

    function log(state) {
        process.stdout.write('.');
        if (state.game.finished) {
            process.stdout.write('\n');
            console.log('Finished %s/%s: %s', i + 1, numGames, state.viewUrl);
        }
    }

    function usage() {
        console.error('Usage: %s [-a|-t] <#numGames> <config>', argv[1]);
        process.exit(1);
    }

    function fatal(pre, err) {
        console.error(pre + ': ' + err.message);
        process.exit(2);
    }
}

module.exports = { start: start, cli: cli };
