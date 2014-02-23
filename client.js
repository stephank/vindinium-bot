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
        throw new Error('bot must be set');
    if (typeof(key) !== 'string')
        throw new Error('key must be set');
    if (mode !== 'arena' && mode !== 'training')
        throw new Error('mode must be set to arena or training');

    var params = { key: key };
    if (mode === 'training') {
        if (config.turns) params.turns = config.turns;
        if (config.map) params.map = config.map;
    }
    gameRequest(serverUrl + '/api/' + mode, params, function(err, state) {
        if (process.send) process.send({ type: 'dequeue' });
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

            var params = { key: key, dir: dir };
            gameRequest(state.playUrl, params, function(err, state) {
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

    var mode, numGames, numChildren, numQueue;
    var numTurns, mapName, cfgFile;
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
        numTurns = argv.turns;
        mapName = argv.map;
    }

    var abortOnInterrupt = (mode === 'training');
    var gameNo = 0;

    if (numGames === 'INF')
        numGames = Infinity;

    if (typeof(numGames) === 'string') {
        var parts = numGames.split(',', 3);
        if (parts.length === 2) {
            numChildren = parseInt(parts[0], 10);
            numGames = parts[1];
            numQueue = numChildren;
        }
        else {
            numQueue = parseInt(parts[0], 10);
            numChildren = parseInt(parts[1], 10);
            numGames = parts[2];
        }

        if (numGames === 'INF')
            numGames = Infinity;
        else
            numGames = parseInt(numGames, 10);
    }
    else {
        numChildren = 1;
        numQueue = numChildren;
    }

    if (!numGames || numGames < 1) usage();
    if (!numChildren || numChildren < 1) usage();
    if (!numQueue || numQueue < 1 || numQueue > numChildren) usage();

    if (cluster.isWorker) {
        readConfig(function(config) {
            start(config, function(err, state) {
                if (err) console.error('Request error: %s', err.message);
                cluster.worker.disconnect();
            });
        });

        process.on('SIGINT', function() {
            if (abortOnInterrupt) process.exit(1);

            abortOnInterrupt = true;
        });
    }
    else if (numChildren === 1) {
        readConfig(singleProcessLoop);

        process.on('SIGINT', function() {
            if (abortOnInterrupt) process.exit(1);

            abortOnInterrupt = true;
            numGames = 0;
            warnGraceful();
        });
    }
    else {
        readConfig(masterLoop);

        process.on('SIGINT', function() {
            if (abortOnInterrupt) return;

            abortOnInterrupt = true;
            numGames = 0;
            warnGraceful();
        });
    }

    function readConfig(cb) {
        fs.readFile(cfgFile, 'utf8', function(err, config) {
            if (err) fatal('Failed to open config', err);

            try { config = JSON.parse(config); }
            catch (e) { fatal('Failed to parse config', e); }

            config.bot = bot;
            config.mode = mode;
            config.log = log;
            if (mode === 'training') {
                config.turns = numTurns;
                config.map = mapName;
            }

            cb(config);
        });
    }

    function masterLoop(config) {
        while (numGames && numChildren && numQueue) {
            var worker = cluster.fork();
            worker.on('exit', onExit);
            worker.on('message', onMessage);

            numGames--;
            numChildren--;
            numQueue--;
        }

        function onExit() {
            numChildren++;
            masterLoop(config);
        }

        function onMessage(msg) {
            if (msg.type === 'dequeue') {
                numQueue++;
                masterLoop(config);
            }
        }
    }

    function singleProcessLoop(config) {
        start(config, function(err, state) {
            if (err) console.error('Request error: %s', err.message);
            if (--numGames > 0) singleProcessLoop(config);
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
