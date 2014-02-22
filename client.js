var fs = require('fs');
var request = require('request');

function start(serverUrl, key, mode, bot, cb) {
    var state;
    if ('arena' === mode) {
        console.log('Connected and waiting for other players to join...');
    }
    getNewGameState(serverUrl, key, mode, function(err, state) {
        if (err) {
            console.log('Failed to start game', err);
            return cb();
        }
        console.log('Playing at: %s', state.viewUrl);

        loop(key, state, bot, cb);
    });
}

function getNewGameState(serverUrl, key, mode, cb) {
    request.post({
        url: serverUrl + '/api/' + mode,
        form: { key: key }
    }, function(err, res, body) {
        if (err)
            return cb(err);
        if (res.statusCode !== 200)
            return cb(new Error('Unable to start game: ' + res.statusCode + ' ' + body));

        try { body = JSON.parse(body); }
        catch (e) { return cb(e); }

        cb(null, body);
    });
}

function loop(key, state, bot, cb) {
    if (isFinished(state)) return cb();

    process.stdout.write('.');
    var url = state.playUrl;
    bot(state, function(dir) {
        state = move(url, key, dir, function(err, newState) {
            if (err) {
                console.log('ERROR:', err);
                cb();
            } else {
                loop(key, newState, bot, cb);
            }
        });
    });
}

function isFinished(state) {
    return state && state.game && state.game.finished;
}

function move(url, key, dir, cb) {
    request.post({
        url: url,
        form: { key: key, dir: dir }
    }, function(err, res, body) {
        if (err)
            return cb(err);
        if (res.statusCode !== 200)
            return cb(new Error('Unable to move: ' + res.statusCode + ' ' + body));

        try { body = JSON.parse(body); }
        catch (e) { return cb(e); }

        cb(null, body);
    });
}

function cli(bot) {
    var argv = process.argv;
    var mode, games, config;
    if (argv[2] === '-a') {
        if (argv.length !== 5) usage();
        mode = 'arena';
        games = parseInt(argv[3], 10);
        config = argv[4];
    }
    else if (argv[2] === '-t') {
        if (argv.length !== 5) usage();
        mode = 'training';
        games = parseInt(argv[3], 10);
        config = argv[4];
    }
    else {
        usage();
    }

    var key, serverUrl;
    fs.readFile(config, 'utf8', function(err, data) {
        if (err) fatal('Failed to open config', err);

        try { config = JSON.parse(data); }
        catch (e) { fatal('Failed to parse config', e); }

        key = config.key;
        serverUrl = config.serverUrl || 'http://vindinium.org';
        playGame();
    });

    var i = 0;
    function playGame() {
        start(serverUrl, key, mode, bot, function() {
            console.log('Game Finished:', i + 1, '/', games);
            if (++i < games) playGame();
        });
    }

    function usage() {
        console.error('Usage: %s [-a|-t] <#games> <config>', argv[1]);
        process.exit(1);
    }

    function fatal(pre, err) {
        console.error(pre + ': ' + err.message);
        process.exit(2);
    }
}

module.exports = { start: start, cli: cli };
