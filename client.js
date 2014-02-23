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

function cli(bot, log) {
    if (!log) {
        log = function(state) {
            process.stdout.write('.');
            if (state.game.finished) {
                process.stdout.write('\n');
                console.log('Finished %s/%s: %s', i + 1, numGames, state.viewUrl);
            }
        };
    }

    var mode, numGames, numChildren, cfgFile, config;
    var argv = require('optimist').argv;
    var cluster = require('cluster');

    if (argv._.length !== 1) usage();
    if (Boolean(argv.a) === Boolean(argv.t)) usage();

    cfgFile = argv._[0];
    if (argv.a) {
        mode = 'arena';
        numGames = argv.a;
    }
    else if (argv.t) {
        mode = 'training';
        numGames = argv.t;
    }

    var match = /^(\d+)x(.+)$/.exec(numGames);
    if (match) {
        numChildren = parseInt(match[1], 10);
        numGames = match[2];
    }
    else {
        numChildren = 1;
    }

    if (numGames === 'INF')
        numGames = Infinity;
    else
        numGames = parseInt(numGames, 10);
    if (!numGames || numGames < 1)
        usage();

    var abortOnInterrupt = (mode === 'training');
    var gameNo = 0;

    if (numChildren > 1 && cluster.isMaster) {
        for (i = 0; i < numChildren; i++)
            cluster.fork();

        process.on('SIGINT', function() {
            if (!abortOnInterrupt) {
                abortOnInterrupt = true;
                warnGraceful();
            }
        });
    }
    else {
        fs.readFile(cfgFile, 'utf8', function(err, data) {
            if (err) fatal('Failed to open config', err);

            try { config = JSON.parse(data); }
            catch (e) { fatal('Failed to parse config', e); }

            config.bot = bot;
            config.mode = mode;
            config.log = log;
            playGame();
        });

        process.on('SIGINT', function() {
            if (abortOnInterrupt)
                process.exit(1);

            abortOnInterrupt = true;
            numGames = 0;
            if (!cluster.worker) warnGraceful();
        });
    }

    function playGame() {
        start(config, function(err, state) {
            if (err)
                fatal("Request error", err);
            if (++gameNo < numGames)
                playGame();
            else if (cluster.worker)
                cluster.worker.disconnect();
        });
    }

    function usage() {
        console.error('Usage: %s [-a|-t] <numGames> <config>', process.argv[1]);
        process.exit(1);
    }

    function fatal(pre, err) {
        console.error(pre + ': ' + err.message);
        process.exit(2);
    }

    function warnGraceful() {
        console.log('### SIGINT: Finishing matches. Press again to abort.');
    }
}

module.exports = { start: start, cli: cli };
