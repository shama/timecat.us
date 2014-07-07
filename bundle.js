(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var terminal = require('browser-terminal')
var bashful = require('bashful')
var timecat = require('./lib/timecat.js')
var mantimecat = require('./lib/mantimecat.js')

var sh = bashful({
  env: {
    PS1: '$ ',
  },
  spawn: function(cmd, args) {
    var fullcmd = [cmd].concat(args).join(' ')
    if (fullcmd === 'time cat') {
      return timecat.call(this, args)
    } else if (fullcmd === 'man time cat') {
      return mantimecat.call(this, args)
    }
  }
});
var term = terminal().appendTo('#terminal')
term.pipe(sh.createStream()).pipe(term)
window.addEventListener('keydown', term.keydown)

// disable cursor blink
term._cursorMoved = function() {}
term._cursor.className = 'cursor'

var startText = 'man time cat'.split('')
function writeIt() {
  var letter = startText.shift()
  if (!letter) return
  term.keydown({
    keyCode: letter.charCodeAt(0),
    preventDefault: function() {}
  })
  setTimeout(writeIt, 150)
}
setTimeout(function() {
  writeIt()
}, 400)

// Fix for browser-terminal
term._reposition = function() {
    if (!this._termStyle) return;
    
    var nodes = this.element.childNodes[0].childNodes;
    var current = nodes[this._term.term.y];
    
    var lineDiv = this._term.term.element.childNodes[this._term.term.y];
    this._cursor.style.top = (
        parseInt(lineDiv.offsetTop)
        + parseInt(this._termStyle.paddingTop)
        + 2
    ) + 'px';
    this._cursor.style.left = (
        this._charSize.width * this._term.term.x
        + parseInt(this._termStyle.paddingLeft)
    ) + 'px';
    this._cursor.textContent = current.textContent.charAt(this._term.term.x);
}
},{"./lib/mantimecat.js":2,"./lib/timecat.js":3,"bashful":4,"browser-terminal":32}],2:[function(require,module,exports){
var through = require('through')
var nextback = require('nextback')
module.exports = function(args) {
  var start = false
  var tr = through()
  nextback(function() {
    var about = [
      'TIME CAT(6)                   Time Cat Manual                  TIME CAT(6)',
      '<strong>NAME</strong>',
      '    <strong>time cat</strong> -- everyone\'s favorite game',
      '',
      '<strong>SYNOPSIS</strong>',
      '    <strong>time cat</strong>',
      '',
      '<strong>DESCRIPTION</strong>',
      '    <strong>time cat</strong> is a game where you type <strong>time cat</strong>, hit enter, count to',
      '    1000 milliseconds (counting quickly is recommended) then finally',
      '    press control + c to get your score.',
      '',
      '    For scores to be officially counted you must play with at least 1 other person. Each player must',
      '    take only one turn at a time. If you go twice in a row your score will not be counted.',
      '',
      '    The person closest to 1.000 second without going over wins.',
      '',
      '    This is an online version of the one that is likely already installed',
      '    on your computer. Open a terminal and type <strong>time cat</strong> to play offline.',
      '',
      '<strong>DIFFICULTY SELECT</strong>',
      '    * easy         --  1.000 second',
      '    * normal       --  5.000 seconds',
      '    * hard         -- 13.000 seconds',
      '    * chronos bast -- 97.000 seconds',
      '',
      '<strong>AUTHOR</strong>',
      '    This game was invented by <strong><a href="https://twitter.com/maxogden">Max Ogden</a></strong> at <a href="http://nodeconf.com">nodeconf</a>.',
      '',
      '    This website was created by <strong><a href="https://twitter.com/shamakry">shama</a></strong> and it is <a href="https://github.com/shama/timecat.us">open source on github</a>.',
      '',
    ].join('\n')
    tr.queue(about + '\n')
    tr.queue(null)
  })()
  return tr
}

},{"nextback":84,"through":85}],3:[function(require,module,exports){
var through = require('through')
module.exports = function(args) {
  var start = false
  var tr = through(function(data) {
    if (start === false) {
      start = Date.now()
    } else {
      var diff = Date.now() - start
      var minutes = 0
      if (diff > 1000) {
        minutes = Math.floor(diff / 1000 / 60).toFixed()
        diff = diff - (minutes * 60 * 1000)
      }
      var seconds = Number(diff / 1000).toFixed(3)
      if (seconds.toString().length === 1) seconds += '.000'
      else if (seconds.toString().length === 3) seconds += '00'
      else if (seconds.toString().length === 4) seconds += '0'
      this.queue('\n')
      this.queue('real    ' + minutes + 'm' + seconds + 's\n')
      this.queue('user    0m0.001s\n')
      this.queue('sys     0m0.002s\n')
      this.queue(null)
    }
  })
  tr.pause()
  return tr
}

},{"through":85}],4:[function(require,module,exports){
(function (process){
var through = require('through');
var resumer = require('resumer');
var duplexer = require('duplexer');
var shellQuote = require('shell-quote');
var decodePrompt = require('decode-prompt');
var path = require('path');

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var nextTick = require('./lib/next_tick.js');

var stringify = JSON.stringify

module.exports = Bash;
inherits(Bash, EventEmitter);

function Bash (opts) {
    if (!(this instanceof Bash)) return new Bash(opts);
    if (!opts) opts = {};
    this.env = opts.env || {};
    if (this.env.PS1 === undefined) {
        this.env.PS1 = opts.isTTY === false
            ? '\\w \\$ '
            : '\\w \\$ '
        ;
    }
    if (!this.env.PWD) this.env.PWD = '/';
    this.custom = opts.custom || [];
    
    this._reader = opts.read || function () {};
    this._writer = opts.write || function () {};
    this._spawner = opts.spawn || function () {};
    this._exists = opts.exists || function (file, cb) { cb(false) };
    this._globber = opts.glob || function (p, cb) { cb(p) };
    
    this._cursorX = 0;
    this.history = [];
    this.historyIndex = 0;
    this._historyLast = null;
    this.jobs = {};
}

Bash.prototype._read = function (rfile) {
    var file = path.resolve(this.env.PWD, rfile);
    this.emit('read', file);
    if (this._reader) return this._reader(file);
};

Bash.prototype._write = function (rfile) {
    var file = path.resolve(this.env.PWD, rfile);
    this.emit('write', file);
    if (this._writer) return this._writer(file);
};

Bash.prototype._spawn = function (cmd, args, opts) {
    this.emit('spawn', cmd, args, opts);
    if (this._spawner) return this._spawner(cmd, args, opts);
};

Bash.prototype.getPrompt = function () {
    return decodePrompt(this.env.PS1, {
        env: this.env
    });
};

Bash.prototype.createStream = function () {
    var self = this;
    
    var line = '';
    var mode = null;
    
    var input = through(function write (buf) {
        if (typeof buf !== 'string') buf = buf.toString('utf8');
        if (self.current) self.current.write(buf);
        
        for (var i = 0; i < buf.length; i++) {
            var c = buf.charCodeAt(i);
            if (self.current) {}
            else if (mode === 'escape' && c === 0x5b) {
                mode = '[';
                continue;
            }
            else if (mode === 'escape' && c === 0x4f) {
                mode = 'O';
                continue;
            }
            else if (mode === '[' && c >= 65 && c <= 68) {
                var dir = {
                    A: 'up', B: 'down', C: 'right', D: 'left'
                }[String.fromCharCode(c)];
                
                if (dir === 'left' && self._cursorX) {
                    self._cursorX --;
                    output.queue('\x1b\x5bD');
                }
                else if (dir === 'right' && self._cursorX < line.length) {
                    self._cursorX ++;
                    output.queue('\x1b\x5bC');
                }
                else if (dir === 'up') {
                    if (self._cursorX !== line.length) {
                        output.queue(
                            '\x1b[' + (line.length - self._cursorX) + 'C'
                        );
                        self._cursorX = line.length;
                    }
                    else if (self.historyIndex > 0) {
                        if (self.historyIndex === self.history.length
                        && self._historyLast === null) {
                            self._historyLast = line;
                        }
                        line = self.history[-- self.historyIndex];
                        if (self._cursorX) {
                            output.queue(
                                '\x1b[' + self._cursorX + 'D\x1b[K'
                                + line
                            );
                        }
                        else output.queue(line);
                        self._cursorX = line.length;
                    }
                }
                else if (dir === 'down'
                && self.historyIndex <= self.history.length - 1) {
                    if (self.historyIndex === self.history.length - 1) {
                        line = self._historyLast || '';
                        self.historyIndex ++;
                    }
                    else line = self.history[++ self.historyIndex];
                    if (self._cursorX) {
                        output.queue(
                            '\x1b[' + self._cursorX + 'D\x1b[K'
                            + line
                        );
                    }
                    else output.queue(line)
                    
                    self._cursorX = line.length;
                }
                
                mode = null;
                continue;
            }
            else if (mode === '[' && (c >= 48 && c <= 57)) {
                mode = '[' + buf.charAt(i);
                continue;
            }
            else if (/^\[\d/.test(mode) && c === 0x7e) {
                if (mode === '[3') { // delete
                    var before = line.slice(0, self._cursorX);
                    var after = line.slice(self._cursorX + 1);
                    line = before + after;
                    output.queue(
                        '\x1b[K' + after + '\x1b[' + after.length + 'D'
                    );
                }
                // todo: pgup, pgdown, insert
                mode = null;
                continue;
            }
            else if (mode === 'O') {
                var ch = buf.charAt(i);
                if (ch === 'F') { // end
                    output.queue('\x1b[' + (line.length - self._cursorX) + 'C');
                    self._cursorX = line.length;
                }
                else if (ch === 'H') { // home
                    output.queue('\x1b[' + self._cursorX + 'D');
                    self._cursorX = 0;
                }
                mode = null;
                continue;
            }
            else if (mode) {
                mode = null;
                continue;
            }
            
            if (c === 3) {
                if (self.current) {
                    line = '';
                    self.current.emit('SIGINT');
                    output.queue('^C');
                }
                else {
                    line = '';
                    self._cursorX = 0;
                    self.historyIndex = self.history.length;
                    self._historyLast = null;
                    output.queue('\n');
                    output.queue(self.getPrompt());
                }
                return write(buf.slice(i + 1));
            }
            else if (c === 4) {
                if (self.current) self.current.end();
                else this.queue(null);
                self._cursorX = 0;
                return write(buf.slice(i + 1));
            }
            else if (c === 8 || c === 0x7f) {
                if (self._cursorX) {
                    self._cursorX --;
                    var before = line.slice(0, self._cursorX)
                    var after = line.slice(self._cursorX + 1)
                    line = before + after;
                    
                    if (after.length) {
                        output.queue(
                            '\010\x1b[K' + after
                            + '\x1b[' + after.length + 'D'
                        );
                    }
                    else output.queue('\010 \010');
                }
                return write(buf.slice(i + 1));
            }
            else if (c === 10 || c === 13) {
                input.queue(line);
                if (line.length) {
                    self.history.push(line);
                    self.historyIndex = self.history.length;
                    self._historyLast = null;
                }
                self._cursorX = 0;
                line = '';
                return write(buf.slice(i + 1));
            }
            else if (c === 0x1b) {
                mode = 'escape';
            }
            else {
                var before = line.slice(0, self._cursorX);
                var after = line.slice(self._cursorX);
                var middle = String.fromCharCode(c);
                
                if (!/\s/.test(middle) && c < 26) {
                    output.queue('^' + String.fromCharCode(64 + c));
                }
                line = before + middle + after;
                
                if (after.length && middle === ' ') {
                    output.queue(
                        '\x1b[K' + after
                        + '\x1b[' + (after.length + 1) + 'D '
                    );
                }
                else if (after.length) {
                    output.queue(
                        '\x1b[K' + after
                        + '\x1b[' + after.length + 'D'
                    );
                }
                self._cursorX ++;
            }
        }
    }, inputEnd);
    
    function inputEnd () {
        if (line.length) this.queue(line);
        var jobs = Object.keys(self.jobs);
        var pending = jobs.length;
        if (pending > 0) {
            jobs.forEach(function (index) {
                var j = self.jobs[index];
                j.on('data', function (buf) {
                    //output.queue(buf);
                });
                j.on('end', function () {
                    if (--pending === 0) input.queue(null);
                });
            });
        }
        else input.queue(null);
    }
    
    var closed = false;
    
    var output = resumer();
    self.on('bgdata', function (buf) {
        output.queue(buf);
    });
    output.queue(self.getPrompt());
    
    self.current = null;
    self.once('exit', end);
    
    var queue = [];
    input.pipe(through(write, end));
    return duplexer(input, output);
    
    function write (buf) {
        var line = typeof buf === 'string' ? buf : buf.toString('utf8');
        if (line === '') {
            if (!closed) {
                output.queue(self.getPrompt());
            }
            return;
        }
        if (self.current) return queue.push(line);
        
        var p = self.eval(line);
        p.on('SIGALRM', exit('SIGALRM', 142, 'Alarm clock'));
        p.on('SIGHUP', exit('SIGHUP', 129, 'Hangup'));
        p.on('SIGINT', exit('SIGINT', 0, ''));
        p.on('SIGKILL', exit('SIGKILL', 137, 'Killed'));
        p.on('SIGPIPE', exit('SIGPIPE', 141, ''));
        p.on('SIGPOLL', exit('SIGPOLL', 157, 'I/O possible'));
        p.on('SIGPROF', exit('SIGPROF', 155, 'Profiling timer expired'));
        p.on('SIGTERM', exit('SIGTERM', 143, 'Terminated'));
        p.on('SIGUSR1', exit('SIGUSR1', 138, 'User defined signal 1'));
        p.on('SIGUSR2', exit('SIGUSR2', 140, 'User defined signal 2'));
        p.on('SIGVTALRM', exit('SIGVTALRM', 154, 'Virtual timer expired'));
        p.on('SIGSTKFLT', exit('SIGSTKFLT', 144, 'Stack fault'));
        
        function exit (name, code, msg) {
            return function () {
                if (name === 'SIGKILL' || p.listeners(name).length === 1) {
                    output.queue(msg + '\n');
                    p.emit('exit', code);
                }
                else p.emit('exit', code);
            };
        }
        
        self.current = p;
        
        p.pause();
        p.pipe(through(null, function () { p.emit('exit', 0) }));
        
        var exitCode = null;
        p.on('exit', function (code) {
            if (exitCode !== null) return;
            exitCode = code;
            self.current = null;
            nextTick(function () {
                if (!closed) output.queue(self.getPrompt());
                if (queue.length) {
                    write(queue.shift());
                }
                else if (closed) {
                    output.queue(null);
                    self.emit('exit', 0);
                }
            });
        });
        p.pipe(output, { end: false });
        p.resume();
    }
    
    function end () {
        closed = true;
        if (!self.current) {
            output.queue(null);
            self.emit('exit', 0);
        }
    }
};

Bash.prototype.emit = function (name) {
    var self = this;
    var args = [].slice.call(arguments, 1);
    var res;
    this.listeners(name).forEach(function (fn) {
        res = res || fn.apply(self, args);
    });
    return res;
};

Bash.prototype.eval = function (line) {
    var self = this;
    if (!/\S+/.test(line)) {
        return builtins.echo.call(self, [ '-n' ]);
    }
    var input = through(), output = resumer();
    
    if (Array.isArray(line)) line = line.join(' ');
    var parts = shellQuote.parse(line, function (key) {
        return { env: key };
    });
    var commands = [];
    
    for (var i = 0; i < parts.length; i++) {
        if (typeof parts[i] === 'object' && parts[i].op === 'glob') {
            // todo: globs
            parts[i] = parts[i].pattern;
        }
    }
    for (var i = 0; i < parts.length; i++) {
        if (typeof parts[i] === 'object' && parts[i].op) {
            commands.push(parts[i]);
        }
        else {
            var cmd = commands[commands.length-1];
            if (!cmd || !cmd.command) {
                cmd = { command: parts[i], args: [] };
                commands.push(cmd);
            }
            else cmd.args.push(parts[i]);
        }
    }
    
    var index = 0;
    
    (function run (prevCode) {
        self.env['?'] = prevCode;
        
        if (commands.length === 0) {
            return nextTick(function () {
                output.emit('exit', self.env['?']);
                output.queue(null);
            });
        }
        var cmd = shiftCommand();
        var redirected = false;
        
        while (commands[0] && /^[&|<>]$/.test(commands[0].op)) {
            var op = commands.shift().op;
            if (op === '|') {
                cmd = cmd.pipe(shiftCommand());
            }
            else if (op === '&') {
                var index = self._jobIndex();
                self.jobs[index] = cmd;
                (function (cmd, index) {
                    process.nextTick(function () {
                        cmd.on('data', function (buf) {
                            self.emit('bgdata', buf);
                        });
                    });
                    cmd.on('end', function () {
                        delete self.jobs[index];
                        self.emit('done', index, cmd);
                    });
                })(cmd, index);
                self.emit('detach', cmd);
                if (commands.length) {
                    cmd = shiftCommand();
                }
                else {
                    cmd = builtins['true'].call(self, []);
                }
            }
            else if (op === '>') {
                var c = commands.shift();
                var file = typeof c === 'object' && c.env
                    ? self.env[c.env]
                    : c.command
                ;
                var ws = self._write(file);
                ws.on('error', function (err) {
                    output.queue(file + ': ' + (err.message || err) + '\n');
                    exitCode = err && err.code || 1;
                });
                if (!ws) {
                    output.queue(file + ': No such file or directory\n');
                    exitCode = 1;
                }
                else cmd.pipe(ws);
                redirected = true;
            }
            else if (op === '<') {
                var c = commands.shift();
                var file = typeof c === 'object' && c.env
                    ? self.env[c.env]
                    : c.command
                ;
                var rs = self._read(file);
                rs.on('error', function (err) {
                    output.queue(file + ': ' + (err.message || err) + '\n');
                    exitCode = err && err.code || 1;
                });
                if (!rs) {
                    output.queue(file + ': No such file or directory\n');
                    exitCode = 1;
                }
                else rs.pipe(cmd);
            }
        }
        
        var exitCode = 0;
        if (!redirected) cmd.pipe(output, { end: false });
        
        cmd.on('exit', function (code) { exitCode = exitCode || code });
        cmd.on('end', function () {
            for (var next = commands[0]; next && next.op; next = commands[0]) {
                commands.shift();
                if (next && next.op === '&&' && exitCode !== 0) {
                    commands.shift();
                    exitCode = 1;
                }
                else if (next && next.op === '||' && exitCode === 0) {
                    commands.shift();
                    exitCode = 1;
                }
            }
            run(exitCode);
        });
        return cmd;
    })(0);
    
    function shiftCommand () {
        var c = commands.shift();
        var cmd = c.command;
        var args = c.args.map(function (arg) {
            if (typeof arg === 'object' && arg.env) {
                var r = self.env[arg.env];
                if (r === undefined) r = '';
                return String(r);
            }
            else return arg;
        }).filter(Boolean);
        
        var localEnv = null;
        while (typeof cmd === 'string' && /^\w+=/.test(cmd)) {
            var m = /^(\w+)=(?:"((?:[^"]|\\")*)"|'((?:[^']|\\')*)'|(.*))/
                .exec(cmd)
            ;
            var key = m[1], value = m[2] || m[3] || m[4] || '';
            
            if (!localEnv) localEnv = copy(self.env);
            localEnv[key] = value;
            
            cmd = args.shift();
            if (cmd === undefined) {
                Object.keys(localEnv).forEach(function (key) {
                    self.env[key] = localEnv[key];
                });
                var tr = resumer();
                tr.command = cmd;
                tr.arguments = args;
                tr.queue(null);
                return tr;
            }
        }
        
        if (typeof cmd === 'object' && cmd.env) {
            cmd = self.env[cmd.env];
        }
        
        if (builtins[cmd] && self.custom.indexOf(cmd) < 0) {
            var p = builtins[cmd].call(self, args);
            p.command = cmd;
            p.arguments = args;
            return p;
        }
        
        var p = self._spawn(cmd, args, {
            env: localEnv || self.env,
            cwd: self.env.PWD
        });
        
        if (p && p.stdin && p.stdout) {
            var d = duplexer(p.stdin, p.stdout);
            d.command = cmd;
            d.arguments = args;
            p.on('exit', function (code) { d.emit('exit', code) });
            return d;
        }
        if (!p) {
            p = resumer();
            p.queue('No command ' + stringify(cmd) + ' found\n');
            p.queue(null);
        }
        
        if (index++ === 0) input.pipe(p);
        
        p.command = cmd;
        p.arguments = args;
        
        return p;
    }
    
    return duplexer(input, output);
};

Bash.prototype._jobIndex = function () {
    var jobs = Object.keys(this.jobs).map(Number);
    if (jobs.length === 0) return 0;
    return Math.max.apply(null, jobs) + 1;
};

function copy (obj) {
    var res = {};
    Object.keys(obj).forEach(function (key) {
        res[key] = obj[key];
    });
    return res;
}

var builtins = require('./lib/builtins/index.js');
builtins.eval = Bash.prototype.eval;

}).call(this,require("FWaASH"))
},{"./lib/builtins/index.js":9,"./lib/next_tick.js":14,"FWaASH":69,"decode-prompt":16,"duplexer":19,"events":66,"inherits":20,"path":68,"resumer":22,"shell-quote":24,"through":31}],5:[function(require,module,exports){
var resumer = require('resumer');
var nextTick = require('../next_tick.js');
var parseArgs = require('minimist');
var path = require('path');

module.exports = function (args) {
    var env = this.env;
    var dir = env.HOME;
    var argv = parseArgs(args);
    
    var dir = (argv._[0] === undefined ? env.HOME : argv._[0]) || '';
    var edir = dir.replace(/^~\//, function () { return env.HOME + '/' });
    edir = path.resolve(env.PWD, edir);
    
    var tr = resumer();
    if (this._exists) this._exists(edir, onexists);
    else nextTick(function () { onexists(false) });
    
    return tr;
    
    function onexists (ex) {
        if (ex) {
            env.PWD = edir;
            tr.emit('exit', 0);
            tr.queue(null);
        }
        else {
            tr.queue('cd: ' + dir + ': No such file or directory\n');
            tr.emit('exit', 1);
            tr.queue(null);
        }
    }
};

},{"../next_tick.js":14,"minimist":21,"path":68,"resumer":22}],6:[function(require,module,exports){
var resumer = require('resumer');

module.exports = function (args) {
    var tr = resumer();
    
    var opts = { newline: true, 'escape': false };
    for (var i = 0; i < args.length; i++) {
        if (args[i] === '-n') {
            opts.newline = false;
            args.splice(i--, 1);
        }
        else if (args[i] === '-e') {
            opts['escape'] = true;
            args.splice(i--, 1);
        }
        else if (args[i] === '-E') {
            opts['escape'] = false;
            args.splice(i--, 1);
        }
    }
    
    if (args.length) tr.queue(args.join(' '));
    if (opts.newline) tr.queue('\n');
    tr.queue(null);
    
    return tr;
};

},{"resumer":22}],7:[function(require,module,exports){
var through = require('through');

module.exports = function (args) {
    this.emit('exit', parseInt(args[0] || '0'));
    return through();
};

},{"through":31}],8:[function(require,module,exports){
var resumerExit = require('../resumer_exit.js');

module.exports = function (args) {
    return resumerExit(1);
};

},{"../resumer_exit.js":15}],9:[function(require,module,exports){
exports.echo = require('./echo.js');
exports.cd = require('./cd.js');
exports.pwd = require('./pwd.js');
exports.exit = require('./exit.js');
exports['true'] = require('./true.js');
exports['false'] = require('./false.js');
exports.jobs = require('./jobs.js');
exports.pushd = require('./pushd.js');

},{"./cd.js":5,"./echo.js":6,"./exit.js":7,"./false.js":8,"./jobs.js":10,"./pushd.js":11,"./pwd.js":12,"./true.js":13}],10:[function(require,module,exports){
var resumer = require('../resumer_exit.js');

module.exports = function (args) {
    var tr = resumer();
    var jobs = this.jobs;
    tr.queue(Object.keys(jobs).map(function (ix) {
        var j = jobs[ix];
        return '[' + ix + '] '
            + (j.command + ' ' + j.arguments.join(' ')).replace(/\s+$/, '')
            + '\n'
        ;
    }).join(''));
    return tr;
};

},{"../resumer_exit.js":15}],11:[function(require,module,exports){
var resumer = require('resumer');
var resumerExit = require('../resumer_exit');
var nextTick = require('../next_tick.js');
var path = require('path');
var rotate = require('rotate-array');

module.exports = function (args) {
    var env = this.env;
    var dirs = (this.dirs = this.dirs || []);
    var tr;
    var dir;
    var swap;
    var shift;

    function suppressExists(dir) {
        var tr = resumerExit(0);
        if (!dir) return tr;
        dirs.unshift(dir);
        tr.queue(env.PWD + ' ' + dirs.join(' ') + '\n');
        return tr;
    }

    // replace ^env.HOME with ~ (for display)

    // pushd +N/-N
    if (/^[+-]\d+$/.test(args[0])) {
        // Using parseInt directly and checking for NaN
        // values would cause false positives for directory
        // names starting with integers, hence the regexp
        var num = parseInt(args[0], 10);
        if (Math.abs(num) > dirs.length) {
            tr = resumerExit(1);
            // Use args[0] to preserve '+' prefix for positive numbers
            tr.queue('pushd: ' + args[0] + ': directory stack index out of range\n');
            return tr;
        }
        dirs.unshift(env.PWD);
        rotate(dirs, num);
        dir = dirs.shift();
        shift = true;

    // pushd -n dir
    } else if (args[0] === "-n") return suppressExists(args[1]);

    // pushd dir -n
    else if (args[1] === "-n") return suppressExists(args[0]);

    // pushd dir
    else if (args[0]) dir = args[0];

    // pushd
    else {
        if (dirs.length === 0) {
            tr = resumerExit(1);
            tr.queue('pushd: no other directory\n');
            return tr;
        }
        dir = dirs.shift();
        swap = true;
    }

    var edir = dir.replace(/^~/, env.HOME);
    edir = path.resolve(env.PWD, edir);

    tr = resumer();
    if (this._exists) this._exists(edir, onexists);
    else nextTick(function () { onexists(false) });

    return tr;

    function onexists (ex) {
        if (ex) {
            if (!shift) dirs.unshift(env.PWD);
            env.PWD = edir;
            tr.queue(edir + ' ' + dirs.join(' ') + '\n');
            tr.queue(null);
            tr.emit('exit', 0);
        }
        else {
            if (swap) dirs.unshift(env.PWD);
            tr.queue('pushd: ' + edir + ': No such file or directory\n');
            tr.queue(null);
            tr.emit('exit', 1);
        }
    }
};

},{"../next_tick.js":14,"../resumer_exit":15,"path":68,"resumer":22,"rotate-array":23}],12:[function(require,module,exports){
var resumerExit = require('../resumer_exit.js');

module.exports = function (args) {
    var tr = resumerExit(0);
    tr.queue(this.env.PWD + '\n');
    return tr;
};

},{"../resumer_exit.js":15}],13:[function(require,module,exports){
var resumerExit = require('../resumer_exit.js');

module.exports = function (args) {
    return resumerExit(0);
};

},{"../resumer_exit.js":15}],14:[function(require,module,exports){
(function (process){
module.exports = typeof setImmediate === 'function'
    ? setImmediate : process.nextTick
;

}).call(this,require("FWaASH"))
},{"FWaASH":69}],15:[function(require,module,exports){
var through = require('through');
var nextTick = require('./next_tick.js');

module.exports = function (code) {
    var tr = through();
    tr.pause();
    nextTick(function () {
        tr.emit('exit', code);
        tr.queue(null);
        tr.resume();
    });
    return tr;
};

},{"./next_tick.js":14,"through":31}],16:[function(require,module,exports){
(function (process){
var path = require('path');
var os = require('os');
var strftime = require('strftime');
var re = RegExp(
    '\\\\[adehHjlnrstT@AuvVwW!#$\\\\[\\]]|\\\\[0-7]{3}'
        + '|(\\$|\\\\D){[^}]*}',
    'g'
);

module.exports = function (str, opts) {
    if (!opts) opts = {};
    if (!opts.env) opts.env = {};
    
    return str.replace(re, replacer);
    
    function replacer (s) {
        var m;
        
        var x = s.charAt(1);
        if (x === 'a') return '\x07';
        if (x === 'e') return '\x1b';
        if (x === 'd') return strftime('%a %b %d', opts.now);
        if (x === 'D') {
            m = /^\\D{([^}]*)}/.exec(s);
            return strftime(m[1], opts.now);
        }
        if (x === 'h') return (opts.hostname || os.hostname()).split('.')[0];
        if (x === 'H') return (opts.hostname || os.hostname());
        if (x === 'j') return opts.jobs || 0; // number of jobs
        if (x === 'l') return path.basename(opts.tty || '-1'); // basename `tty`
        if (x === 'n') return '\n';
        if (x === 'r') return '\r';
        if (x === 's') return path.basename(opts.shell || opts.env.SHELL);
        if (x === 't') return strftime('%T', opts.now);
        if (x === 'T') return strftime('%I:%M:%S', opts.now);
        if (x === '@') return strftime('%r', opts.now);
        if (x === 'A') return strftime('%H:%M', opts.now);
        if (x === 'u') return opts.user || opts.env.USER;
        if (x === 'v') {
            return (opts.version || '0.0.0').replace(/^(\d+\.\d+).*/, '$1');
        }
        if (x === 'V') return opts.version || '0.0.0';
        if (x === 'w') {
            var dir = opts.cwd || opts.env.PWD || process.cwd();
            var home = opts.env.HOME + '/';
            if (dir + '/' === home) return '~';
            if (dir.slice(0, home.length) === home) {
                dir = '~/' + dir.slice(home.length);
            }
            var dirtrim = parseInt(opts.dirtrim || opts.env.PROMPT_DIRTRIM, 10);
            if (!(dirtrim > 0)) return dir;
            var parts = dir.split('/');
            if (parts.length <= dirtrim + 1) return dir;
            return (/^~/.test(dir) ? '~/' : '')
                + '.../' + parts.slice(- dirtrim).join('/')
            ;
        }
        if (x === 'W') {
            var dir = opts.cwd || opts.env.PWD || process.cwd();
            if (dir === opts.env.HOME) return '~';
            return path.basename(dir) || '/';
        }
        if (x === '!') return opts.history === undefined ? 0 : opts.history;
        if (x === '#') return opts.command === undefined ? 0 : opts.command;
        if (x === '$') {
            var uid = opts.uid || opts.env.UID || process.getuid();
            return uid === 0 ? '#' : '$';
        }
        
        if (m = /^\${([^}]+)}/.exec(s)) {
            return opts.env[m[1]] || '';
        }
        if (m = /^\$(\w+)/.exec(s)) {
            return opts.env[m[1]] || '';
        }
        
        if (x === '[') return '';
        if (x === ']') return '';
        
        if (/^\\[0-7]{1,3}$/.test(s)) {
            return String.fromCharCode(parseInt(s.slice(1), 8));
        }
        return x;
    }
};

}).call(this,require("FWaASH"))
},{"FWaASH":69,"os":17,"path":68,"strftime":18}],17:[function(require,module,exports){
exports.hostname = function () { return location.hostname }

},{}],18:[function(require,module,exports){
//
// strftime
// github.com/samsonjs/strftime
// @_sjs
//
// Copyright 2010 - 2013 Sami Samhuri <sami@samhuri.net>
//
// MIT License
// http://sjs.mit-license.org
//

;(function() {

  //// Export the API
  var namespace;

  // CommonJS / Node module
  if (typeof module !== 'undefined') {
    namespace = module.exports = strftime;
  }

  // Browsers and other environments
  else {
    // Get the global object. Works in ES3, ES5, and ES5 strict mode.
    namespace = (function(){ return this || (1,eval)('this') }());
  }

  namespace.strftime = strftime;
  namespace.strftimeUTC = strftime.strftimeUTC = strftimeUTC;
  namespace.localizedStrftime = strftime.localizedStrftime = localizedStrftime;

  ////

  function words(s) { return (s || '').split(' '); }

  var DefaultLocale =
  { days: words('Sunday Monday Tuesday Wednesday Thursday Friday Saturday')
  , shortDays: words('Sun Mon Tue Wed Thu Fri Sat')
  , months: words('January February March April May June July August September October November December')
  , shortMonths: words('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec')
  , AM: 'AM'
  , PM: 'PM'
  , am: 'am'
  , pm: 'pm'
  };

  function strftime(fmt, d, locale) {
    return _strftime(fmt, d, locale, false);
  }

  function strftimeUTC(fmt, d, locale) {
    return _strftime(fmt, d, locale, true);
  }

  function localizedStrftime(locale) {
    return function(fmt, d) {
      return strftime(fmt, d, locale);
    };
  }

  // locale is an object with the same structure as DefaultLocale
  function _strftime(fmt, d, locale, _useUTC) {
    // d and locale are optional so check if d is really the locale
    if (d && !quacksLikeDate(d)) {
      locale = d;
      d = undefined;
    }
    d = d || new Date();
    locale = locale || DefaultLocale;
    locale.formats = locale.formats || {};
    var msDelta = 0;
    if (_useUTC) {
      msDelta = (d.getTimezoneOffset() || 0) * 60000;
      d = new Date(d.getTime() + msDelta);
    }

    // Most of the specifiers supported by C's strftime, and some from Ruby.
    // Some other syntax extensions from Ruby are supported: %-, %_, and %0
    // to pad with nothing, space, or zero (respectively).
    return fmt.replace(/%([-_0]?.)/g, function(_, c) {
      var mod, padding;
      if (c.length == 2) {
        mod = c[0];
        // omit padding
        if (mod == '-') {
          padding = '';
        }
        // pad with space
        else if (mod == '_') {
          padding = ' ';
        }
        // pad with zero
        else if (mod == '0') {
          padding = '0';
        }
        else {
          // unrecognized, return the format
          return _;
        }
        c = c[1];
      }
      switch (c) {
        case 'A': return locale.days[d.getDay()];
        case 'a': return locale.shortDays[d.getDay()];
        case 'B': return locale.months[d.getMonth()];
        case 'b': return locale.shortMonths[d.getMonth()];
        case 'C': return pad(Math.floor(d.getFullYear() / 100), padding);
        case 'D': return _strftime(locale.formats.D || '%m/%d/%y', d, locale);
        case 'd': return pad(d.getDate(), padding);
        case 'e': return d.getDate();
        case 'F': return _strftime(locale.formats.F || '%Y-%m-%d', d, locale);
        case 'H': return pad(d.getHours(), padding);
        case 'h': return locale.shortMonths[d.getMonth()];
        case 'I': return pad(hours12(d), padding);
        case 'j':
          var y=new Date(d.getFullYear(), 0, 1);
          var day = Math.ceil((d.getTime() - y.getTime()) / (1000*60*60*24));
          return pad(day, 3);
        case 'k': return pad(d.getHours(), padding == null ? ' ' : padding);
        case 'L': return pad(Math.floor(d.getTime() % 1000), 3);
        case 'l': return pad(hours12(d), padding == null ? ' ' : padding);
        case 'M': return pad(d.getMinutes(), padding);
        case 'm': return pad(d.getMonth() + 1, padding);
        case 'n': return '\n';
        case 'o': return String(d.getDate()) + ordinal(d.getDate());
        case 'P': return d.getHours() < 12 ? locale.am : locale.pm;
        case 'p': return d.getHours() < 12 ? locale.AM : locale.PM;
        case 'R': return _strftime(locale.formats.R || '%H:%M', d, locale);
        case 'r': return _strftime(locale.formats.r || '%I:%M:%S %p', d, locale);
        case 'S': return pad(d.getSeconds(), padding);
        case 's': return Math.floor((d.getTime() - msDelta) / 1000);
        case 'T': return _strftime(locale.formats.T || '%H:%M:%S', d, locale);
        case 't': return '\t';
        case 'U': return pad(weekNumber(d, 'sunday'), padding);
        case 'u':
          var day = d.getDay();
          return day == 0 ? 7 : day; // 1 - 7, Monday is first day of the week
        case 'v': return _strftime(locale.formats.v || '%e-%b-%Y', d, locale);
        case 'W': return pad(weekNumber(d, 'monday'), padding);
        case 'w': return d.getDay(); // 0 - 6, Sunday is first day of the week
        case 'Y': return d.getFullYear();
        case 'y':
          var y = String(d.getFullYear());
          return y.slice(y.length - 2);
        case 'Z':
          if (_useUTC) {
            return "GMT";
          }
          else {
            var tz = d.toString().match(/\((\w+)\)/);
            return tz && tz[1] || '';
          }
        case 'z':
          if (_useUTC) {
            return "+0000";
          }
          else {
            var off = d.getTimezoneOffset();
            return (off < 0 ? '+' : '-') + pad(Math.abs(off / 60)) + pad(off % 60);
          }
        default: return c;
      }
    });
  }

  var RequiredDateMethods = ['getTime', 'getTimezoneOffset', 'getDay', 'getDate', 'getMonth', 'getFullYear', 'getYear', 'getHours', 'getMinutes', 'getSeconds'];
  function quacksLikeDate(x) {
    var i = 0
      , n = RequiredDateMethods.length
      ;
    for (i = 0; i < n; ++i) {
      if (typeof x[RequiredDateMethods[i]] != 'function') {
        return false;
      }
    }
    return true;
  }

  // Default padding is '0' and default length is 2, both are optional.
  function pad(n, padding, length) {
    // pad(n, <length>)
    if (typeof padding === 'number') {
      length = padding;
      padding = '0';
    }

    // Defaults handle pad(n) and pad(n, <padding>)
    if (padding == null) {
      padding = '0';
    }
    length = length || 2;

    var s = String(n);
    // padding may be an empty string, don't loop forever if it is
    if (padding) {
      while (s.length < length) s = padding + s;
    }
    return s;
  }

  function hours12(d) {
    var hour = d.getHours();
    if (hour == 0) hour = 12;
    else if (hour > 12) hour -= 12;
    return hour;
  }

  // Get the ordinal suffix for a number: st, nd, rd, or th
  function ordinal(n) {
    var i = n % 10
      , ii = n % 100
      ;
    if ((ii >= 11 && ii <= 13) || i === 0 || i >= 4) {
      return 'th';
    }
    switch (i) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
    }
  }

  // firstWeekday: 'sunday' or 'monday', default is 'sunday'
  //
  // Pilfered & ported from Ruby's strftime implementation.
  function weekNumber(d, firstWeekday) {
    firstWeekday = firstWeekday || 'sunday';

    // This works by shifting the weekday back by one day if we
    // are treating Monday as the first day of the week.
    var wday = d.getDay();
    if (firstWeekday == 'monday') {
      if (wday == 0) // Sunday
        wday = 6;
      else
        wday--;
    }
    var firstDayOfYear = new Date(d.getFullYear(), 0, 1)
      , yday = (d - firstDayOfYear) / 86400000
      , weekNum = (yday + 7 - wday) / 7
      ;
    return Math.floor(weekNum);
  }

}());

},{}],19:[function(require,module,exports){
var Stream = require("stream")
    , writeMethods = ["write", "end", "destroy"]
    , readMethods = ["resume", "pause"]
    , readEvents = ["data", "close"]
    , slice = Array.prototype.slice

module.exports = duplex

function duplex(writer, reader) {
    var stream = new Stream()
        , ended = false

    writeMethods.forEach(proxyWriter)

    readMethods.forEach(proxyReader)

    readEvents.forEach(proxyStream)

    reader.on("end", handleEnd)

    writer.on("drain", function() {
      stream.emit("drain")
    })

    writer.on("error", reemit)
    reader.on("error", reemit)

    stream.writable = writer.writable
    stream.readable = reader.readable

    return stream

    function proxyWriter(methodName) {
        stream[methodName] = method

        function method() {
            return writer[methodName].apply(writer, arguments)
        }
    }

    function proxyReader(methodName) {
        stream[methodName] = method

        function method() {
            stream.emit(methodName)
            var func = reader[methodName]
            if (func) {
                return func.apply(reader, arguments)
            }
            reader.emit(methodName)
        }
    }

    function proxyStream(methodName) {
        reader.on(methodName, reemit)

        function reemit() {
            var args = slice.call(arguments)
            args.unshift(methodName)
            stream.emit.apply(stream, args)
        }
    }

    function handleEnd() {
        if (ended) {
            return
        }
        ended = true
        var args = slice.call(arguments)
        args.unshift("end")
        stream.emit.apply(stream, args)
    }

    function reemit(err) {
        stream.emit("error", err)
    }
}

},{"stream":83}],20:[function(require,module,exports){
module.exports = inherits

function inherits (c, p, proto) {
  proto = proto || {}
  var e = {}
  ;[c.prototype, proto].forEach(function (s) {
    Object.getOwnPropertyNames(s).forEach(function (k) {
      e[k] = Object.getOwnPropertyDescriptor(s, k)
    })
  })
  c.prototype = Object.create(p.prototype, e)
  c.super = p
}

//function Child () {
//  Child.super.call(this)
//  console.error([this
//                ,this.constructor
//                ,this.constructor === Child
//                ,this.constructor.super === Parent
//                ,Object.getPrototypeOf(this) === Child.prototype
//                ,Object.getPrototypeOf(Object.getPrototypeOf(this))
//                 === Parent.prototype
//                ,this instanceof Child
//                ,this instanceof Parent])
//}
//function Parent () {}
//inherits(Child, Parent)
//new Child

},{}],21:[function(require,module,exports){
module.exports = function (args, opts) {
    if (!opts) opts = {};
    
    var flags = { bools : {}, strings : {} };
    
    [].concat(opts['boolean']).filter(Boolean).forEach(function (key) {
        flags.bools[key] = true;
    });
    
    var aliases = {};
    Object.keys(opts.alias || {}).forEach(function (key) {
        aliases[key] = [].concat(opts.alias[key]);
        aliases[key].forEach(function (x) {
            aliases[x] = [key].concat(aliases[key].filter(function (y) {
                return x !== y;
            }));
        });
    });

    [].concat(opts.string).filter(Boolean).forEach(function (key) {
        flags.strings[key] = true;
        if (aliases[key]) {
            flags.strings[aliases[key]] = true;
        }
     });

    var defaults = opts['default'] || {};
    
    var argv = { _ : [] };
    Object.keys(flags.bools).forEach(function (key) {
        setArg(key, defaults[key] === undefined ? false : defaults[key]);
    });
    
    var notFlags = [];

    if (args.indexOf('--') !== -1) {
        notFlags = args.slice(args.indexOf('--')+1);
        args = args.slice(0, args.indexOf('--'));
    }

    function setArg (key, val) {
        var value = !flags.strings[key] && isNumber(val)
            ? Number(val) : val
        ;
        setKey(argv, key.split('.'), value);
        
        (aliases[key] || []).forEach(function (x) {
            setKey(argv, x.split('.'), value);
        });
    }
    
    for (var i = 0; i < args.length; i++) {
        var arg = args[i];
        
        if (/^--.+=/.test(arg)) {
            // Using [\s\S] instead of . because js doesn't support the
            // 'dotall' regex modifier. See:
            // http://stackoverflow.com/a/1068308/13216
            var m = arg.match(/^--([^=]+)=([\s\S]*)$/);
            setArg(m[1], m[2]);
        }
        else if (/^--no-.+/.test(arg)) {
            var key = arg.match(/^--no-(.+)/)[1];
            setArg(key, false);
        }
        else if (/^--.+/.test(arg)) {
            var key = arg.match(/^--(.+)/)[1];
            var next = args[i + 1];
            if (next !== undefined && !/^-/.test(next)
            && !flags.bools[key]
            && (aliases[key] ? !flags.bools[aliases[key]] : true)) {
                setArg(key, next);
                i++;
            }
            else if (/^(true|false)$/.test(next)) {
                setArg(key, next === 'true');
                i++;
            }
            else {
                setArg(key, flags.strings[key] ? '' : true);
            }
        }
        else if (/^-[^-]+/.test(arg)) {
            var letters = arg.slice(1,-1).split('');
            
            var broken = false;
            for (var j = 0; j < letters.length; j++) {
                var next = arg.slice(j+2);
                
                if (next === '-') {
                    setArg(letters[j], next)
                    continue;
                }
                
                if (/[A-Za-z]/.test(letters[j])
                && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) {
                    setArg(letters[j], next);
                    broken = true;
                    break;
                }
                
                if (letters[j+1] && letters[j+1].match(/\W/)) {
                    setArg(letters[j], arg.slice(j+2));
                    broken = true;
                    break;
                }
                else {
                    setArg(letters[j], flags.strings[letters[j]] ? '' : true);
                }
            }
            
            var key = arg.slice(-1)[0];
            if (!broken && key !== '-') {
                if (args[i+1] && !/^(-|--)[^-]/.test(args[i+1])
                && !flags.bools[key]
                && (aliases[key] ? !flags.bools[aliases[key]] : true)) {
                    setArg(key, args[i+1]);
                    i++;
                }
                else if (args[i+1] && /true|false/.test(args[i+1])) {
                    setArg(key, args[i+1] === 'true');
                    i++;
                }
                else {
                    setArg(key, flags.strings[key] ? '' : true);
                }
            }
        }
        else {
            argv._.push(
                flags.strings['_'] || !isNumber(arg) ? arg : Number(arg)
            );
        }
    }
    
    Object.keys(defaults).forEach(function (key) {
        if (!hasKey(argv, key.split('.'))) {
            setKey(argv, key.split('.'), defaults[key]);
            
            (aliases[key] || []).forEach(function (x) {
                setKey(argv, x.split('.'), defaults[key]);
            });
        }
    });
    
    notFlags.forEach(function(key) {
        argv._.push(key);
    });

    return argv;
};

function hasKey (obj, keys) {
    var o = obj;
    keys.slice(0,-1).forEach(function (key) {
        o = (o[key] || {});
    });

    var key = keys[keys.length - 1];
    return key in o;
}

function setKey (obj, keys, value) {
    var o = obj;
    keys.slice(0,-1).forEach(function (key) {
        if (o[key] === undefined) o[key] = {};
        o = o[key];
    });
    
    var key = keys[keys.length - 1];
    if (o[key] === undefined || typeof o[key] === 'boolean') {
        o[key] = value;
    }
    else if (Array.isArray(o[key])) {
        o[key].push(value);
    }
    else {
        o[key] = [ o[key], value ];
    }
}

function isNumber (x) {
    if (typeof x === 'number') return true;
    if (/^0x[0-9a-f]+$/i.test(x)) return true;
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x);
}


},{}],22:[function(require,module,exports){
(function (process){
var through = require('through');
var nextTick = typeof setImmediate !== 'undefined'
    ? setImmediate
    : process.nextTick
;

module.exports = function (write, end) {
    var tr = through(write, end);
    tr.pause();
    var resume = tr.resume;
    var pause = tr.pause;
    var paused = false;
    
    tr.pause = function () {
        paused = true;
        return pause.apply(this, arguments);
    };
    
    tr.resume = function () {
        paused = false;
        return resume.apply(this, arguments);
    };
    
    nextTick(function () {
        if (!paused) tr.resume();
    });
    
    return tr;
};

}).call(this,require("FWaASH"))
},{"FWaASH":69,"through":31}],23:[function(require,module,exports){
'use strict';

module.exports = function (array, num) {
    num = (num || 0) % array.length;
    if (num < 0) {
        num += array.length;
    }
    var removed = array.splice(0, num);
    array.push.apply(array, removed);
    return array;
};

},{}],24:[function(require,module,exports){
var json = typeof JSON !== undefined ? JSON : require('jsonify');
var map = require('array-map');
var filter = require('array-filter');
var reduce = require('array-reduce');

exports.quote = function (xs) {
    return map(xs, function (s) {
        if (s && typeof s === 'object') {
            return s.op.replace(/(.)/g, '\\$1');
        }
        else if (/["\s]/.test(s) && !/'/.test(s)) {
            return "'" + s.replace(/(['\\])/g, '\\$1') + "'";
        }
        else if (/["'\s]/.test(s)) {
            return '"' + s.replace(/(["\\$`(){}!#&*|])/g, '\\$1') + '"';
        }
        else {
            return s.replace(/([\\$`(){}!#&*|])/g, '\\$1');
        }
    }).join(' ');
};

var CONTROL = '(?:' + [
    '\\|\\|', '\\&\\&', ';;', '\\|\\&', '[&;()|<>]'
].join('|') + ')';
var META = '|&;()<> \\t';
var BAREWORD = '(\\\\[\'"' + META + ']|[^\\s\'"' + META + '])+';
var SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
var DOUBLE_QUOTE = '\'((\\\\\'|[^\'])*?)\'';

var TOKEN = '';
for (var i = 0; i < 4; i++) {
    TOKEN += (Math.pow(16,8)*Math.random()).toString(16);
}

exports.parse = function (s, env) {
    var mapped = parse(s, env);
    if (typeof env !== 'function') return mapped;
    return reduce(mapped, function (acc, s) {
        if (typeof s === 'object') return acc.concat(s);
        var xs = s.split(RegExp('(' + TOKEN + '.*?' + TOKEN + ')', 'g'));
        if (xs.length === 1) return acc.concat(xs[0]);
        return acc.concat(map(filter(xs, Boolean), function (x) {
            if (RegExp('^' + TOKEN).test(x)) {
                return json.parse(x.split(TOKEN)[1]);
            }
            else return x;
        }));
    }, []);
};

function parse (s, env) {
    var chunker = new RegExp([
        '(' + CONTROL + ')', // control chars
        '(' + BAREWORD + '|' + SINGLE_QUOTE + '|' + DOUBLE_QUOTE + ')*'
    ].join('|'), 'g');
    var match = filter(s.match(chunker), Boolean);
    
    if (!match) return [];
    if (!env) env = {};
    return map(match, function (s) {
        if (RegExp('^' + CONTROL + '$').test(s)) {
            return { op: s };
        }

        // Hand-written scanner/parser for Bash quoting rules:
        //
        //  1. inside single quotes, all characters are printed literally.
        //  2. inside double quotes, all characters are printed literally
        //     except variables prefixed by '$' and backslashes followed by
        //     either a double quote or another backslash.
        //  3. outside of any quotes, backslashes are treated as escape
        //     characters and not printed (unless they are themselves escaped)
        //  4. quote context can switch mid-token if there is no whitespace
        //     between the two quote contexts (e.g. all'one'"token" parses as
        //     "allonetoken")
        var SQ = "'";
        var DQ = '"';
        var BS = '\\';
        var DS = '$';
        var quote = false;
        var varname = false;
        var esc = false;
        var out = '';
        var isGlob = false;

        for (var i = 0, len = s.length; i < len; i++) {
            var c = s.charAt(i);
            isGlob = isGlob || (!quote && (c === '*' || c === '?'))
            if (esc) {
                out += c;
                esc = false;
            }
            else if (quote) {
                if (c === quote) {
                    quote = false;
                }
                else if (quote == SQ) {
                    out += c;
                }
                else { // Double quote
                    if (c === BS) {
                        i += 1;
                        c = s.charAt(i);
                        if (c === DQ || c === BS || c === DS) {
                            out += c;
                        } else {
                            out += BS + c;
                        }
                    }
                    else if (c === DS) {
                        out += parseEnvVar();
                    }
                    else {
                        out += c
                    }
                }
            }
            else if (c === DQ || c === SQ) {
                quote = c
            }
            else if (RegExp('^' + CONTROL + '$').test(c)) {
                return { op: s };
            }
            else if (c === BS) {
                esc = true
            }
            else if (c === DS) {
                out += parseEnvVar();
            }
            else out += c;
        }

        if (isGlob) return {op: 'glob', pattern: out};

        return out

        function parseEnvVar() {
            i += 1;
            var varend, varname;
            //debugger
            if (s.charAt(i) === '{') {
                i += 1
                if (s.charAt(i) === '}') {
                    throw new Error("Bad substitution: " + s.substr(i - 2, 3));
                }
                varend = s.indexOf('}', i);
                if (varend < 0) {
                    throw new Error("Bad substitution: " + s.substr(i));
                }
                varname = s.substr(i, varend - i);
                i = varend;
            }
            else if (/[*@#?$!_\-]/.test(s.charAt(i))) {
                varname = s.charAt(i);
                i += 1;
            }
            else {
                varend = s.substr(i).match(/[^\w\d_]/);
                if (!varend) {
                    varname = s.substr(i);
                    i = s.length;
                } else {
                    varname = s.substr(i, varend.index)
                    i += varend.index - 1;
                }
            }
            return getVar(null, '', varname);
        }
    });
    
    function getVar (_, pre, key) {
        var r = typeof env === 'function' ? env(key) : env[key];
        if (r === undefined) r = '';
        
        if (typeof r === 'object') {
            return pre + TOKEN + json.stringify(r) + TOKEN;
        }
        else return pre + r;
    }
};

},{"array-filter":25,"array-map":26,"array-reduce":27,"jsonify":28}],25:[function(require,module,exports){
/**
 * Array#filter.
 *
 * @param {Array} arr
 * @param {Function} fn
 * @return {Array}
 */

module.exports = function (arr, fn) {
  if (arr.filter) return arr.filter(fn);
  var ret = [];
  for (var i = 0; i < arr.length; i++) {
    if (!hasOwn.call(arr, i)) continue;
    if (fn(arr[i], i, arr)) ret.push(arr[i]);
  }
  return ret;
};

var hasOwn = Object.prototype.hasOwnProperty;

},{}],26:[function(require,module,exports){
module.exports = function (xs, f) {
    if (xs.map) return xs.map(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        var x = xs[i];
        if (hasOwn.call(xs, i)) res.push(f(x, i, xs));
    }
    return res;
};

var hasOwn = Object.prototype.hasOwnProperty;

},{}],27:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;

module.exports = function (xs, f, acc) {
    var hasAcc = arguments.length >= 3;
    if (hasAcc && xs.reduce) return xs.reduce(f, acc);
    if (xs.reduce) return xs.reduce(f);
    
    for (var i = 0; i < xs.length; i++) {
        if (!hasOwn.call(xs, i)) continue;
        if (!hasAcc) {
            acc = xs[i];
            hasAcc = true;
            continue;
        }
        acc = f(acc, xs[i], i);
    }
    return acc;
};

},{}],28:[function(require,module,exports){
exports.parse = require('./lib/parse');
exports.stringify = require('./lib/stringify');

},{"./lib/parse":29,"./lib/stringify":30}],29:[function(require,module,exports){
var at, // The index of the current character
    ch, // The current character
    escapee = {
        '"':  '"',
        '\\': '\\',
        '/':  '/',
        b:    '\b',
        f:    '\f',
        n:    '\n',
        r:    '\r',
        t:    '\t'
    },
    text,

    error = function (m) {
        // Call error when something is wrong.
        throw {
            name:    'SyntaxError',
            message: m,
            at:      at,
            text:    text
        };
    },
    
    next = function (c) {
        // If a c parameter is provided, verify that it matches the current character.
        if (c && c !== ch) {
            error("Expected '" + c + "' instead of '" + ch + "'");
        }
        
        // Get the next character. When there are no more characters,
        // return the empty string.
        
        ch = text.charAt(at);
        at += 1;
        return ch;
    },
    
    number = function () {
        // Parse a number value.
        var number,
            string = '';
        
        if (ch === '-') {
            string = '-';
            next('-');
        }
        while (ch >= '0' && ch <= '9') {
            string += ch;
            next();
        }
        if (ch === '.') {
            string += '.';
            while (next() && ch >= '0' && ch <= '9') {
                string += ch;
            }
        }
        if (ch === 'e' || ch === 'E') {
            string += ch;
            next();
            if (ch === '-' || ch === '+') {
                string += ch;
                next();
            }
            while (ch >= '0' && ch <= '9') {
                string += ch;
                next();
            }
        }
        number = +string;
        if (!isFinite(number)) {
            error("Bad number");
        } else {
            return number;
        }
    },
    
    string = function () {
        // Parse a string value.
        var hex,
            i,
            string = '',
            uffff;
        
        // When parsing for string values, we must look for " and \ characters.
        if (ch === '"') {
            while (next()) {
                if (ch === '"') {
                    next();
                    return string;
                } else if (ch === '\\') {
                    next();
                    if (ch === 'u') {
                        uffff = 0;
                        for (i = 0; i < 4; i += 1) {
                            hex = parseInt(next(), 16);
                            if (!isFinite(hex)) {
                                break;
                            }
                            uffff = uffff * 16 + hex;
                        }
                        string += String.fromCharCode(uffff);
                    } else if (typeof escapee[ch] === 'string') {
                        string += escapee[ch];
                    } else {
                        break;
                    }
                } else {
                    string += ch;
                }
            }
        }
        error("Bad string");
    },

    white = function () {

// Skip whitespace.

        while (ch && ch <= ' ') {
            next();
        }
    },

    word = function () {

// true, false, or null.

        switch (ch) {
        case 't':
            next('t');
            next('r');
            next('u');
            next('e');
            return true;
        case 'f':
            next('f');
            next('a');
            next('l');
            next('s');
            next('e');
            return false;
        case 'n':
            next('n');
            next('u');
            next('l');
            next('l');
            return null;
        }
        error("Unexpected '" + ch + "'");
    },

    value,  // Place holder for the value function.

    array = function () {

// Parse an array value.

        var array = [];

        if (ch === '[') {
            next('[');
            white();
            if (ch === ']') {
                next(']');
                return array;   // empty array
            }
            while (ch) {
                array.push(value());
                white();
                if (ch === ']') {
                    next(']');
                    return array;
                }
                next(',');
                white();
            }
        }
        error("Bad array");
    },

    object = function () {

// Parse an object value.

        var key,
            object = {};

        if (ch === '{') {
            next('{');
            white();
            if (ch === '}') {
                next('}');
                return object;   // empty object
            }
            while (ch) {
                key = string();
                white();
                next(':');
                if (Object.hasOwnProperty.call(object, key)) {
                    error('Duplicate key "' + key + '"');
                }
                object[key] = value();
                white();
                if (ch === '}') {
                    next('}');
                    return object;
                }
                next(',');
                white();
            }
        }
        error("Bad object");
    };

value = function () {

// Parse a JSON value. It could be an object, an array, a string, a number,
// or a word.

    white();
    switch (ch) {
    case '{':
        return object();
    case '[':
        return array();
    case '"':
        return string();
    case '-':
        return number();
    default:
        return ch >= '0' && ch <= '9' ? number() : word();
    }
};

// Return the json_parse function. It will have access to all of the above
// functions and variables.

module.exports = function (source, reviver) {
    var result;
    
    text = source;
    at = 0;
    ch = ' ';
    result = value();
    white();
    if (ch) {
        error("Syntax error");
    }

    // If there is a reviver function, we recursively walk the new structure,
    // passing each name/value pair to the reviver function for possible
    // transformation, starting with a temporary root object that holds the result
    // in an empty key. If there is not a reviver function, we simply return the
    // result.

    return typeof reviver === 'function' ? (function walk(holder, key) {
        var k, v, value = holder[key];
        if (value && typeof value === 'object') {
            for (k in value) {
                if (Object.prototype.hasOwnProperty.call(value, k)) {
                    v = walk(value, k);
                    if (v !== undefined) {
                        value[k] = v;
                    } else {
                        delete value[k];
                    }
                }
            }
        }
        return reviver.call(holder, key, value);
    }({'': result}, '')) : result;
};

},{}],30:[function(require,module,exports){
var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
    escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
    gap,
    indent,
    meta = {    // table of character substitutions
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
    },
    rep;

function quote(string) {
    // If the string contains no control characters, no quote characters, and no
    // backslash characters, then we can safely slap some quotes around it.
    // Otherwise we must also replace the offending characters with safe escape
    // sequences.
    
    escapable.lastIndex = 0;
    return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
        var c = meta[a];
        return typeof c === 'string' ? c :
            '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
    }) + '"' : '"' + string + '"';
}

function str(key, holder) {
    // Produce a string from holder[key].
    var i,          // The loop counter.
        k,          // The member key.
        v,          // The member value.
        length,
        mind = gap,
        partial,
        value = holder[key];
    
    // If the value has a toJSON method, call it to obtain a replacement value.
    if (value && typeof value === 'object' &&
            typeof value.toJSON === 'function') {
        value = value.toJSON(key);
    }
    
    // If we were called with a replacer function, then call the replacer to
    // obtain a replacement value.
    if (typeof rep === 'function') {
        value = rep.call(holder, key, value);
    }
    
    // What happens next depends on the value's type.
    switch (typeof value) {
        case 'string':
            return quote(value);
        
        case 'number':
            // JSON numbers must be finite. Encode non-finite numbers as null.
            return isFinite(value) ? String(value) : 'null';
        
        case 'boolean':
        case 'null':
            // If the value is a boolean or null, convert it to a string. Note:
            // typeof null does not produce 'null'. The case is included here in
            // the remote chance that this gets fixed someday.
            return String(value);
            
        case 'object':
            if (!value) return 'null';
            gap += indent;
            partial = [];
            
            // Array.isArray
            if (Object.prototype.toString.apply(value) === '[object Array]') {
                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }
                
                // Join all of the elements together, separated with commas, and
                // wrap them in brackets.
                v = partial.length === 0 ? '[]' : gap ?
                    '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' :
                    '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }
            
            // If the replacer is an array, use it to select the members to be
            // stringified.
            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    k = rep[i];
                    if (typeof k === 'string') {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }
            else {
                // Otherwise, iterate through all of the keys in the object.
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }
            
        // Join all of the member texts together, separated with commas,
        // and wrap them in braces.

        v = partial.length === 0 ? '{}' : gap ?
            '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' :
            '{' + partial.join(',') + '}';
        gap = mind;
        return v;
    }
}

module.exports = function (value, replacer, space) {
    var i;
    gap = '';
    indent = '';
    
    // If the space parameter is a number, make an indent string containing that
    // many spaces.
    if (typeof space === 'number') {
        for (i = 0; i < space; i += 1) {
            indent += ' ';
        }
    }
    // If the space parameter is a string, it will be used as the indent string.
    else if (typeof space === 'string') {
        indent = space;
    }

    // If there is a replacer, it must be a function or an array.
    // Otherwise, throw an error.
    rep = replacer;
    if (replacer && typeof replacer !== 'function'
    && (typeof replacer !== 'object' || typeof replacer.length !== 'number')) {
        throw new Error('JSON.stringify');
    }
    
    // Make a fake root object containing our value under the key of ''.
    // Return the result of stringifying the value.
    return str('', {'': value});
};

},{}],31:[function(require,module,exports){
(function (process){
var Stream = require('stream')

// through
//
// a stream that does nothing but re-emit the input.
// useful for aggregating a series of changing but not ending streams into one stream)

exports = module.exports = through
through.through = through

//create a readable writable stream.

function through (write, end, opts) {
  write = write || function (data) { this.queue(data) }
  end = end || function () { this.queue(null) }

  var ended = false, destroyed = false, buffer = [], _ended = false
  var stream = new Stream()
  stream.readable = stream.writable = true
  stream.paused = false

//  stream.autoPause   = !(opts && opts.autoPause   === false)
  stream.autoDestroy = !(opts && opts.autoDestroy === false)

  stream.write = function (data) {
    write.call(this, data)
    return !stream.paused
  }

  function drain() {
    while(buffer.length && !stream.paused) {
      var data = buffer.shift()
      if(null === data)
        return stream.emit('end')
      else
        stream.emit('data', data)
    }
  }

  stream.queue = stream.push = function (data) {
//    console.error(ended)
    if(_ended) return stream
    if(data == null) _ended = true
    buffer.push(data)
    drain()
    return stream
  }

  //this will be registered as the first 'end' listener
  //must call destroy next tick, to make sure we're after any
  //stream piped from here.
  //this is only a problem if end is not emitted synchronously.
  //a nicer way to do this is to make sure this is the last listener for 'end'

  stream.on('end', function () {
    stream.readable = false
    if(!stream.writable && stream.autoDestroy)
      process.nextTick(function () {
        stream.destroy()
      })
  })

  function _end () {
    stream.writable = false
    end.call(stream)
    if(!stream.readable && stream.autoDestroy)
      stream.destroy()
  }

  stream.end = function (data) {
    if(ended) return
    ended = true
    if(arguments.length) stream.write(data)
    _end() // will emit or queue
    return stream
  }

  stream.destroy = function () {
    if(destroyed) return
    destroyed = true
    ended = true
    buffer.length = 0
    stream.writable = stream.readable = false
    stream.emit('close')
    return stream
  }

  stream.pause = function () {
    if(stream.paused) return
    stream.paused = true
    return stream
  }

  stream.resume = function () {
    if(stream.paused) {
      stream.paused = false
      stream.emit('resume')
    }
    drain()
    //may have become paused again,
    //as drain emits 'data'.
    if(!stream.paused)
      stream.emit('drain')
    return stream
  }
  return stream
}


}).call(this,require("FWaASH"))
},{"FWaASH":69,"stream":83}],32:[function(require,module,exports){
var through = require('through');
var hypernal = require('hypernal');
var charSizer = require('char-size');

module.exports = function () {
    var element = document.createElement('div');
    element.style.position = 'relative';
    element.style.height = 'inherit';
    
    var term = hypernal();
    term.tail = true;
    term.term.convertEol = true;
    term.appendTo(element);
    
    var cursor = document.createElement('div');
    cursor.style.position = 'absolute';
    cursor.style.top = '0px';
    cursor.style.left = '0px';
    cursor.style.height = '1em';
    cursor.style.width = '1ex';
    cursor.style.color = 'transparent';
    
    element.appendChild(cursor);
    
    var stream = through(function (buf) {
        term.write(buf);
        stream._reposition();
    });
    stream._term = term;
    stream._cursor = cursor;
    stream.element = element;
    stream._reposition = reposition;
    stream.keydown = function (ev) { return keydown.call(stream, ev) };
    
    stream.appendTo = function (target) {
        if (typeof target === 'string') {
            target = document.querySelector(target);
        }
        target.appendChild(element);
        
        var style = window.getComputedStyle(target);
        if (style.overflowY !== 'visible') {
            element.style.overflowY = style.overflowY;
        }
        if (style.overflowY === 'scroll') {
            target.style.overflowY = 'auto';
        }
        
        stream._charSize = charSizer(element);
        stream._termStyle = window.getComputedStyle(element);
        
        var nodes = element.childNodes[0].childNodes;
        stream._rowHeight = parseInt(window.getComputedStyle(nodes[0]).height);
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].style.whiteSpace = 'pre-wrap';
            nodes[i].style.wordBreak = 'break-word';
        }
        
        return stream;
    };
    
    stream._cursorMoved = (function () {
        var to;
        return function () {
            cursor.style.backgroundColor = 'white';
            cursor.style.color = 'black';
            
            if (to) clearTimeout(to);
            to = setTimeout(function f () {
                if (cursor.style.backgroundColor === 'white') {
                    cursor.style.backgroundColor = 'transparent';
                    cursor.style.color = 'transparent';
                }
                else {
                    cursor.style.backgroundColor = 'white';
                    cursor.style.color = 'black';
                }
                to = setTimeout(f, 600);
            }, 500);
        };
    })();
    
    return stream;
};

function reposition () {
    if (!this._termStyle) return;
    
    var nodes = this.element.childNodes[0].childNodes;
    var current = nodes[this._term.term.y];
    
    var lineDiv = this._term.term.element.childNodes[this._term.term.y];
    this._cursor.style.top = parseInt(lineDiv.offsetTop)
        + parseInt(this._termStyle.paddingTop)
        + 2
    ;
    this._cursor.style.left = (
        this._charSize.width * this._term.term.x
        + parseInt(this._termStyle.paddingLeft)
    ) + 'px';
    this._cursor.textContent = current.textContent.charAt(this._term.term.x);
}

function keydown (ev) {
    if (typeof ev === 'number') ev = { which: ev };
    var code = ev.which || ev.keyCode;
    var c = String.fromCharCode(code);
    
    if (ev.shiftKey && ev.ctrlKey) return;
    if (ev.ctrlKey && c === 'R') return; // pass ctrl-r through
    if (ev.ctrlKey && c === 'L') return; // pass ctrl-l through

    ev.preventDefault();
    this._cursorMoved();
    
    if (code < 32 && code !== 8 && !/\s/.test(c)) return;
    
    if (code >= 37 && code <= 40) {
        c = '\x1b[' + String.fromCharCode({
            38: 65, 40: 66, 39: 67, 37: 68
        }[code]);
        this.queue(c);
        return;
    }
    else if (code === 33) return this.queue('\x1b[5~'); // pgup
    else if (code === 34) return this.queue('\x1b[6~'); // pgdown
    else if (code === 35) return this.queue('\x1bOF'); // end
    else if (code === 36) return this.queue('\x1bOH'); // home
    else if (code === 45) return this.queue('\x1b[2~'); // insert
    else if (code === 46) return this.queue('\x1b[3~'); // delete
    
    if (/[A-Z]/.test(c) && ev.shiftKey === false) {
        c = c.toLowerCase();
    }
    else if (/\d/.test(c) && ev.shiftKey) {
        c = ')!@#$%^&*('.charAt(parseInt(c));
    }
    else {
        c = ({
            186: [ ';', ':' ],
            187: [ '=', '+' ],
            188: [ ',', '<' ],
            189: [ '-', '_' ],
            190: [ '.', '>' ],
            191: [ '/', '?' ],
            192: [ '`', '~' ],
            219: [ '[', '{' ],
            220: [ '\\', '|' ],
            221: [ ']','}' ],
            222: [ '\'', '"' ]
        }[code] || [ c, c ])[ev.shiftKey ? 1 : 0] || c;
    }
    
    if (/^[a-z]$/.test(c) && ev.ctrlKey) {
        code = code - 64;
        c = String.fromCharCode(code);
    }
    if (code === 7 || code === 8) {
        this.queue(c);
    }
    else {
        if (c === '\r') c = '\n';
        if (c === ' ') {
            this._term.term.x ++;
        }
        else this._term.write(c);
        this.queue(c);
    }
    
    this._reposition();
}

},{"char-size":33,"hypernal":34,"through":62}],33:[function(require,module,exports){
module.exports = function (opts) {
    if (opts && typeof opts.appendChild === 'function') {
        opts = { target: opts }
    }
    if (!opts) opts = {};
    var target = opts.target || document.body;
    var chr = opts.chr || 'x';
    
    var container = document.createElement('div');
    container.style.width = '0px';
    container.style.height = '0px';
    container.style.overflow = 'hidden'; 
    target.appendChild(container);
    
    var div = document.createElement('div');
    div.style.display = 'inline-block';
    div.appendChild(document.createTextNode(chr));
    container.appendChild(div);
    
    var s = window.getComputedStyle(div);
    return {
        width: parseInt(s.width, 10),
        height: parseInt(s.height, 10)
    };
};

},{}],34:[function(require,module,exports){
'use strict';

var Terminal = require('./term')
  , through = require('through')
  ;

function style(parentElem) {
  var currentStyle = parentElem.getAttribute('style') || '';
  // TODO: make white-space work
  // white-space: pre has the following problem:
  // If applied before the terminal is visible, things break horribly to the point that the output is either
  // shifted to the left or not visible at all.
  // However when this style is set after the parent element became visible, it works fine.
  parentElem.setAttribute('style', currentStyle + 'overflow-y: auto; /* white-space: pre; */');
}

function scroll(elem) {
  if (!elem) return;
  elem.scrollTop = elem.scrollHeight;
}

module.exports = function (opts) {
  var term = new Terminal(opts);
  term.open();
  
  var hypernal = through(term.write.bind(term));
  hypernal.appendTo = function (parent) {
    if (typeof parent === 'string') parent = document.querySelector(parent);

    parent.appendChild(term.element);
    style(parent);
    hypernal.container = parent;
    term.element.style.position = 'relative';
  };

  hypernal.writeln = function (line) {
    term.writeln(line);
    if (hypernal.tail) scroll(hypernal.container);
  };

  hypernal.write = function (data) {
    term.write(data);
    if (hypernal.tail) scroll(hypernal.container);
  };

  // convenience shortcuts
  hypernal.reset   =  term.reset.bind(term);
  hypernal.element =  term.element;

  // the underlying term for all other needs
  hypernal.term = term;

  return hypernal;
};

},{"./term":61,"through":62}],35:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {
  Terminal.prototype.blankLine = function(cur) {
    var attr = cur ? this.curAttr : this.defAttr;

    var ch = [attr, ' '],
      line = [],
      i = 0;

    for (; i < this.cols; i++) {
      line[i] = ch;
    }

    return line;
  };
};

},{}],36:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {

Terminal.charsets = {};

  // DEC Special Character and Line Drawing Set.
  // http://vt100.net/docs/vt102-ug/table5-13.html
  // A lot of curses apps use this if they see TERM=xterm.
  // testing: echo -e '\e(0a\e(B'
  // The xterm output sometimes seems to conflict with the
  // reference above. xterm seems in line with the reference
  // when running vttest however.
  // The table below now uses xterm's output from vttest.
  Terminal.charsets.SCLD = { // (0
    '`': '\u25c6', // '◆'
    'a': '\u2592', // '▒'
    'b': '\u0009', // '\t'
    'c': '\u000c', // '\f'
    'd': '\u000d', // '\r'
    'e': '\u000a', // '\n'
    'f': '\u00b0', // '°'
    'g': '\u00b1', // '±'
    'h': '\u2424', // '\u2424' (NL)
    'i': '\u000b', // '\v'
    'j': '\u2518', // '┘'
    'k': '\u2510', // '┐'
    'l': '\u250c', // '┌'
    'm': '\u2514', // '└'
    'n': '\u253c', // '┼'
    'o': '\u23ba', // '⎺'
    'p': '\u23bb', // '⎻'
    'q': '\u2500', // '─'
    'r': '\u23bc', // '⎼'
    's': '\u23bd', // '⎽'
    't': '\u251c', // '├'
    'u': '\u2524', // '┤'
    'v': '\u2534', // '┴'
    'w': '\u252c', // '┬'
    'x': '\u2502', // '│'
    'y': '\u2264', // '≤'
    'z': '\u2265', // '≥'
    '{': '\u03c0', // 'π'
    '|': '\u2260', // '≠'
    '}': '\u00a3', // '£'
    '~': '\u00b7' // '·'
  };

  Terminal.charsets.UK = null; // (A
  Terminal.charsets.US = null; // (B (USASCII)
  Terminal.charsets.Dutch = null; // (4
  Terminal.charsets.Finnish = null; // (C or (5
  Terminal.charsets.French = null; // (R
  Terminal.charsets.FrenchCanadian = null; // (Q
  Terminal.charsets.German = null; // (K
  Terminal.charsets.Italian = null; // (Y
  Terminal.charsets.NorwegianDanish = null; // (E or (6
  Terminal.charsets.Spanish = null; // (Z
  Terminal.charsets.Swedish = null; // (H or (7
  Terminal.charsets.Swiss = null; // (=
  Terminal.charsets.ISOLatin = null; // /A

};

},{}],37:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {

  // Colors 0-15
  Terminal.colors = [
  // dark:
  '#2e3436', '#cc0000', '#4e9a06', '#c4a000', '#3465a4', '#75507b', '#06989a', '#d3d7cf',
  // bright:
  '#555753', '#ef2929', '#8ae234', '#fce94f', '#729fcf', '#ad7fa8', '#34e2e2', '#eeeeec'];

  // Colors 16-255
  // Much thanks to TooTallNate for writing this.
  Terminal.colors = (function() {
    var colors = Terminal.colors,
      r = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff],
      i;

    // 16-231
    i = 0;
    for (; i < 216; i++) {
      out(r[(i / 36) % 6 | 0], r[(i / 6) % 6 | 0], r[i % 6]);
    }

    // 232-255 (grey)
    i = 0;
    for (; i < 24; i++) {
      r = 8 + i * 10;
      out(r, r, r);
    }

    function out(r, g, b) {
      colors.push('#' + hex(r) + hex(g) + hex(b));
    }

    function hex(c) {
      c = c.toString(16);
      return c.length < 2 ? '0' + c : c;
    }

    return colors;
  })();

  // Default BG/FG
  Terminal.defaultColors = {
    bg: '#000000',
    fg: '#f0f0f0'
  };

  Terminal.colors[256] = Terminal.defaultColors.bg;
  Terminal.colors[257] = Terminal.defaultColors.fg;
};

},{}],38:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {

  // CSI Pm m Character Attributes (SGR).
  // Ps = 0 -> Normal (default).
  // Ps = 1 -> Bold.
  // Ps = 4 -> Underlined.
  // Ps = 5 -> Blink (appears as Bold).
  // Ps = 7 -> Inverse.
  // Ps = 8 -> Invisible, i.e., hidden (VT300).
  // Ps = 2 2 -> Normal (neither bold nor faint).
  // Ps = 2 4 -> Not underlined.
  // Ps = 2 5 -> Steady (not blinking).
  // Ps = 2 7 -> Positive (not inverse).
  // Ps = 2 8 -> Visible, i.e., not hidden (VT300).
  // Ps = 3 0 -> Set foreground color to Black.
  // Ps = 3 1 -> Set foreground color to Red.
  // Ps = 3 2 -> Set foreground color to Green.
  // Ps = 3 3 -> Set foreground color to Yellow.
  // Ps = 3 4 -> Set foreground color to Blue.
  // Ps = 3 5 -> Set foreground color to Magenta.
  // Ps = 3 6 -> Set foreground color to Cyan.
  // Ps = 3 7 -> Set foreground color to White.
  // Ps = 3 9 -> Set foreground color to default (original).
  // Ps = 4 0 -> Set background color to Black.
  // Ps = 4 1 -> Set background color to Red.
  // Ps = 4 2 -> Set background color to Green.
  // Ps = 4 3 -> Set background color to Yellow.
  // Ps = 4 4 -> Set background color to Blue.
  // Ps = 4 5 -> Set background color to Magenta.
  // Ps = 4 6 -> Set background color to Cyan.
  // Ps = 4 7 -> Set background color to White.
  // Ps = 4 9 -> Set background color to default (original).

  // If 16-color support is compiled, the following apply. Assume
  // that xterm's resources are set so that the ISO color codes are
  // the first 8 of a set of 16. Then the aixterm colors are the
  // bright versions of the ISO colors:
  // Ps = 9 0 -> Set foreground color to Black.
  // Ps = 9 1 -> Set foreground color to Red.
  // Ps = 9 2 -> Set foreground color to Green.
  // Ps = 9 3 -> Set foreground color to Yellow.
  // Ps = 9 4 -> Set foreground color to Blue.
  // Ps = 9 5 -> Set foreground color to Magenta.
  // Ps = 9 6 -> Set foreground color to Cyan.
  // Ps = 9 7 -> Set foreground color to White.
  // Ps = 1 0 0 -> Set background color to Black.
  // Ps = 1 0 1 -> Set background color to Red.
  // Ps = 1 0 2 -> Set background color to Green.
  // Ps = 1 0 3 -> Set background color to Yellow.
  // Ps = 1 0 4 -> Set background color to Blue.
  // Ps = 1 0 5 -> Set background color to Magenta.
  // Ps = 1 0 6 -> Set background color to Cyan.
  // Ps = 1 0 7 -> Set background color to White.

  // If xterm is compiled with the 16-color support disabled, it
  // supports the following, from rxvt:
  // Ps = 1 0 0 -> Set foreground and background color to
  // default.

  // If 88- or 256-color support is compiled, the following apply.
  // Ps = 3 8 ; 5 ; Ps -> Set foreground color to the second
  // Ps.
  // Ps = 4 8 ; 5 ; Ps -> Set background color to the second
  // Ps.
  Terminal.prototype.charAttributes = function(params) {
    var l = params.length,
      i = 0,
      bg, fg, p;

    for (; i < l; i++) {
      p = params[i];
      if (p >= 30 && p <= 37) {
        // fg color 8
        this.curAttr = (this.curAttr & ~ (0x1ff << 9)) | ((p - 30) << 9);
      } else if (p >= 40 && p <= 47) {
        // bg color 8
        this.curAttr = (this.curAttr & ~0x1ff) | (p - 40);
      } else if (p >= 90 && p <= 97) {
        // fg color 16
        p += 8;
        this.curAttr = (this.curAttr & ~ (0x1ff << 9)) | ((p - 90) << 9);
      } else if (p >= 100 && p <= 107) {
        // bg color 16
        p += 8;
        this.curAttr = (this.curAttr & ~0x1ff) | (p - 100);
      } else if (p === 0) {
        // default
        this.curAttr = this.defAttr;
      } else if (p === 1) {
        // bold text
        this.curAttr = this.curAttr | (1 << 18);
      } else if (p === 4) {
        // underlined text
        this.curAttr = this.curAttr | (2 << 18);
      } else if (p === 7 || p === 27) {
        // inverse and positive
        // test with: echo -e '\e[31m\e[42mhello\e[7mworld\e[27mhi\e[m'
        if (p === 7) {
          if ((this.curAttr >> 18) & 4) continue;
          this.curAttr = this.curAttr | (4 << 18);
        } else if (p === 27) {
          if (~ (this.curAttr >> 18) & 4) continue;
          this.curAttr = this.curAttr & ~ (4 << 18);
        }

        bg = this.curAttr & 0x1ff;
        fg = (this.curAttr >> 9) & 0x1ff;

        this.curAttr = (this.curAttr & ~0x3ffff) | ((bg << 9) | fg);
      } else if (p === 22) {
        // not bold
        this.curAttr = this.curAttr & ~ (1 << 18);
      } else if (p === 24) {
        // not underlined
        this.curAttr = this.curAttr & ~ (2 << 18);
      } else if (p === 39) {
        // reset fg
        this.curAttr = this.curAttr & ~ (0x1ff << 9);
        this.curAttr = this.curAttr | (((this.defAttr >> 9) & 0x1ff) << 9);
      } else if (p === 49) {
        // reset bg
        this.curAttr = this.curAttr & ~0x1ff;
        this.curAttr = this.curAttr | (this.defAttr & 0x1ff);
      } else if (p === 38) {
        // fg color 256
        if (params[i + 1] !== 5) continue;
        i += 2;
        p = params[i] & 0xff;
        // convert 88 colors to 256
        // if (this.is('rxvt-unicode') && p < 88) p = p * 2.9090 | 0;
        this.curAttr = (this.curAttr & ~ (0x1ff << 9)) | (p << 9);
      } else if (p === 48) {
        // bg color 256
        if (params[i + 1] !== 5) continue;
        i += 2;
        p = params[i] & 0xff;
        // convert 88 colors to 256
        // if (this.is('rxvt-unicode') && p < 88) p = p * 2.9090 | 0;
        this.curAttr = (this.curAttr & ~0x1ff) | p;
      }
    }
  };
};

},{}],39:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {
  // CSI s
  // Save cursor (ANSI.SYS).
  Terminal.prototype.saveCursor = function(params) {
    this.savedX = this.x;
    this.savedY = this.y;
  };

  // CSI u
  // Restore cursor (ANSI.SYS).
  Terminal.prototype.restoreCursor = function(params) {
    this.x = this.savedX || 0;
    this.y = this.savedY || 0;
  };

  // CSI Ps A
  // Cursor Up Ps Times (default = 1) (CUU).
  Terminal.prototype.cursorUp = function(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.y -= param;
      if (this.y < 0) this.y = 0;
  };

  // CSI Ps B
  // Cursor Down Ps Times (default = 1) (CUD).
  Terminal.prototype.cursorDown = function(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.y += param;
      if (this.y >= this.rows) {
          this.y = this.rows - 1;
      }
  };

  // CSI Ps C
  // Cursor Forward Ps Times (default = 1) (CUF).
  Terminal.prototype.cursorForward = function(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.x += param;
      if (this.x >= this.cols) {
          this.x = this.cols - 1;
      }
  };

  // CSI Ps D
  // Cursor Backward Ps Times (default = 1) (CUB).
  Terminal.prototype.cursorBackward = function(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.x -= param;
      if (this.x < 0) this.x = 0;
  };

  // CSI Ps ; Ps H
  // Cursor Position [row;column] (default = [1,1]) (CUP).
  Terminal.prototype.cursorPos = function(params) {
      var row, col;

      row = params[0] - 1;

      if (params.length >= 2) {
          col = params[1] - 1;
      } else {
          col = 0;
      }

      if (row < 0) {
          row = 0;
      } else if (row >= this.rows) {
          row = this.rows - 1;
      }

      if (col < 0) {
          col = 0;
      } else if (col >= this.cols) {
          col = this.cols - 1;
      }

      this.x = col;
      this.y = row;
  };
  
  // CSI Ps E
  // Cursor Next Line Ps Times (default = 1) (CNL).
  // same as CSI Ps B ?
  Terminal.prototype.cursorNextLine = function(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.y += param;
      if (this.y >= this.rows) {
          this.y = this.rows - 1;
      }
      this.x = 0;
  };

  // CSI Ps F
  // Cursor Preceding Line Ps Times (default = 1) (CNL).
  // reuse CSI Ps A ?
  Terminal.prototype.cursorPrecedingLine = function(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.y -= param;
      if (this.y < 0) this.y = 0;
      this.x = 0;
  };

  // CSI Ps G
  // Cursor Character Absolute [column] (default = [row,1]) (CHA).
  Terminal.prototype.cursorCharAbsolute = function(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.x = param - 1;
  };

  // CSI Ps I
  // Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
  Terminal.prototype.cursorForwardTab = function(params) {
      var param = params[0] || 1;
      while (param--) {
          this.x = this.nextStop();
      }
  };

  // CSI Ps Z Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
  Terminal.prototype.cursorBackwardTab = function(params) {
      var param = params[0] || 1;
      while (param--) {
          this.x = this.prevStop();
      }
  };

};

},{}],40:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {

  // CSI Ps @
  // Insert Ps (Blank) Character(s) (default = 1) (ICH).
  Terminal.prototype.insertChars = function(params) {
    var param, row, j, ch;

    param = params[0];
    if (param < 1) param = 1;

    row = this.y + this.ybase;
    j = this.x;
    ch = [this.curAttr, ' ']; // xterm

    while (param-- && j < this.cols) {
      this.lines[row].splice(j++, 0, ch);
      this.lines[row].pop();
    }
  };


  // CSI Ps L
  // Insert Ps Line(s) (default = 1) (IL).
  Terminal.prototype.insertLines = function(params) {
    var param, row, j;

    param = params[0];
    if (param < 1) param = 1;
    row = this.y + this.ybase;

    j = this.rows - 1 - this.scrollBottom;
    j = this.rows - 1 + this.ybase - j + 1;

    while (param--) {
      // test: echo -e '\e[44m\e[1L\e[0m'
      // blankLine(true) - xterm/linux behavior
      this.lines.splice(row, 0, this.blankLine(true));
      this.lines.splice(j, 1);
    }

    // this.maxRange();
    this.updateRange(this.y);
    this.updateRange(this.scrollBottom);
  };

  // CSI Ps M
  // Delete Ps Line(s) (default = 1) (DL).
  Terminal.prototype.deleteLines = function(params) {
    var param, row, j;

    param = params[0];
    if (param < 1) param = 1;
    row = this.y + this.ybase;

    j = this.rows - 1 - this.scrollBottom;
    j = this.rows - 1 + this.ybase - j;

    while (param--) {
      // test: echo -e '\e[44m\e[1M\e[0m'
      // blankLine(true) - xterm/linux behavior
      this.lines.splice(j + 1, 0, this.blankLine(true));
      this.lines.splice(row, 1);
    }

    // this.maxRange();
    this.updateRange(this.y);
    this.updateRange(this.scrollBottom);
  };

  // CSI Ps P
  // Delete Ps Character(s) (default = 1) (DCH).
  Terminal.prototype.deleteChars = function(params) {
    var param, row, ch;

    param = params[0];
    if (param < 1) param = 1;

    row = this.y + this.ybase;
    ch = [this.curAttr, ' ']; // xterm

    while (param--) {
      this.lines[row].splice(this.x, 1);
      this.lines[row].push(ch);
    }
  };

  // CSI Ps X
  // Erase Ps Character(s) (default = 1) (ECH).
  Terminal.prototype.eraseChars = function(params) {
    var param, row, j, ch;

    param = params[0];
    if (param < 1) param = 1;

    row = this.y + this.ybase;
    j = this.x;
    ch = [this.curAttr, ' ']; // xterm

    while (param-- && j < this.cols) {
      this.lines[row][j++] = ch;
    }
  };
};

},{}],41:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {
  // CSI Pm ` Character Position Absolute
  // [column] (default = [row,1]) (HPA).
  Terminal.prototype.charPosAbsolute = function(params) {
    var param = params[0];
    if (param < 1) param = 1;
    this.x = param - 1;
    if (this.x >= this.cols) {
      this.x = this.cols - 1;
    }
  };

  // 141 61 a * HPR -
  // Horizontal Position Relative
  // reuse CSI Ps C ?
  Terminal.prototype.HPositionRelative = function(params) {
    var param = params[0];
    if (param < 1) param = 1;
    this.x += param;
    if (this.x >= this.cols) {
      this.x = this.cols - 1;
    }
  };
  
  // CSI Pm d
  // Line Position Absolute [row] (default = [1,column]) (VPA).
  Terminal.prototype.linePosAbsolute = function(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.y = param - 1;
      if (this.y >= this.rows) {
          this.y = this.rows - 1;
      }
  };

  // 145 65 e * VPR - Vertical Position Relative
  // reuse CSI Ps B ?
  Terminal.prototype.VPositionRelative = function(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.y += param;
      if (this.y >= this.rows) {
          this.y = this.rows - 1;
      }
  };

  // CSI Ps ; Ps f
  // Horizontal and Vertical Position [row;column] (default =
  // [1,1]) (HVP).
  Terminal.prototype.HVPosition = function(params) {
      if (params[0] < 1) params[0] = 1;
      if (params[1] < 1) params[1] = 1;

      this.y = params[0] - 1;
      if (this.y >= this.rows) {
          this.y = this.rows - 1;
      }

      this.x = params[1] - 1;
      if (this.x >= this.cols) {
          this.x = this.cols - 1;
      }
  };
};

},{}],42:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {
  // CSI Ps b Repeat the preceding graphic character Ps times (REP).
  Terminal.prototype.repeatPrecedingCharacter = function(params) {
    var param = params[0] || 1,
      line = this.lines[this.ybase + this.y],
      ch = line[this.x - 1] || [this.defAttr, ' '];

    while (param--) line[this.x++] = ch;
  };
};

},{}],43:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {
  // CSI ! p Soft terminal reset (DECSTR).
  // http://vt100.net/docs/vt220-rm/table4-10.html
  Terminal.prototype.softReset = function(params) {
    this.cursorHidden = false;
    this.insertMode = false;
    this.originMode = false;
    this.wraparoundMode = false; // autowrap
    this.applicationKeypad = false; // ?
    this.scrollTop = 0;
    this.scrollBottom = this.rows - 1;
    this.curAttr = this.defAttr;
    this.x = this.y = 0; // ?
    this.charset = null;
    this.glevel = 0; // ??
    this.charsets = [null]; // ??
  };
};

},{}],44:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {
  // CSI Ps g Tab Clear (TBC).
  // Ps = 0 -> Clear Current Column (default).
  // Ps = 3 -> Clear All.
  // Potentially:
  // Ps = 2 -> Clear Stops on Line.
  // http://vt100.net/annarbor/aaa-ug/section6.html
  Terminal.prototype.tabClear = function(params) {
    var param = params[0];
    if (param <= 0) {
      delete this.tabs[this.x];
    } else if (param === 3) {
      this.tabs = {};
    }
  };
};

},{}],45:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {
  Terminal.prototype.log = function() {
    if (!Terminal.debug) return;
    if (!window.console || !window.console.log) return;
    var args = Array.prototype.slice.call(arguments);
    window.console.log.apply(window.console, args);
  };

  Terminal.prototype.error = function() {
    if (!Terminal.debug) return;
    if (!window.console || !window.console.error) return;
    var args = Array.prototype.slice.call(arguments);
    window.console.error.apply(window.console, args);
  };
};

},{}],46:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) { 
  Terminal.prototype.destroy = function() {
    this.readable = false;
    this.writable = false;
    this._events = {};
    this.handler = function() {};
    this.write = function() {};
  };
};

},{}],47:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {
  Terminal.prototype.eraseRight = function(x, y) {
    var line = this.lines[this.ybase + y],
      ch = [this.curAttr, ' ']; // xterm

    for (; x < this.cols; x++) {
      line[x] = ch;
    }

    this.updateRange(y);
  };

  Terminal.prototype.eraseLeft = function(x, y) {
    var line = this.lines[this.ybase + y],
      ch = [this.curAttr, ' ']; // xterm

    x++;
    while (x--) line[x] = ch;

    this.updateRange(y);
  };

  Terminal.prototype.eraseLine = function(y) {
    this.eraseRight(0, y);
  };
  
  // CSI Ps J Erase in Display (ED).
  // Ps = 0 -> Erase Below (default).
  // Ps = 1 -> Erase Above.
  // Ps = 2 -> Erase All.
  // Ps = 3 -> Erase Saved Lines (xterm).
  // CSI ? Ps J
  // Erase in Display (DECSED).
  // Ps = 0 -> Selective Erase Below (default).
  // Ps = 1 -> Selective Erase Above.
  // Ps = 2 -> Selective Erase All.
  Terminal.prototype.eraseInDisplay = function(params) {
      var j;
      switch (params[0]) {
      case 0:
          this.eraseRight(this.x, this.y);
          j = this.y + 1;
          for (; j < this.rows; j++) {
              this.eraseLine(j);
          }
          break;
      case 1:
          this.eraseLeft(this.x, this.y);
          j = this.y;
          while (j--) {
              this.eraseLine(j);
          }
          break;
      case 2:
          j = this.rows;
          while (j--) this.eraseLine(j);
          break;
      case 3:
          ; // no saved lines
          break;
      }
  };

  // CSI Ps K Erase in Line (EL).
  // Ps = 0 -> Erase to Right (default).
  // Ps = 1 -> Erase to Left.
  // Ps = 2 -> Erase All.
  // CSI ? Ps K
  // Erase in Line (DECSEL).
  // Ps = 0 -> Selective Erase to Right (default).
  // Ps = 1 -> Selective Erase to Left.
  // Ps = 2 -> Selective Erase All.
  Terminal.prototype.eraseInLine = function(params) {
      switch (params[0]) {
      case 0:
          this.eraseRight(this.x, this.y);
          break;
      case 1:
          this.eraseLeft(this.x, this.y);
          break;
      case 2:
          this.eraseLine(this.y);
          break;
      }
  };
};

},{}],48:[function(require,module,exports){
'use strict';
var states = require('../states');

module.exports = function (Terminal) {
  // ESC D Index (IND is 0x84).
  Terminal.prototype.index = function() {
    this.y++;
    if (this.y > this.scrollBottom) {
      this.y--;
      this.scroll();
    }
    this.state = states.normal;
  };

  // ESC M Reverse Index (RI is 0x8d).
  Terminal.prototype.reverseIndex = function() {
    var j;
    this.y--;
    if (this.y < this.scrollTop) {
      this.y++;
      // possibly move the code below to term.reverseScroll();
      // test: echo -ne '\e[1;1H\e[44m\eM\e[0m'
      // blankLine(true) is xterm/linux behavior
      this.lines.splice(this.y + this.ybase, 0, this.blankLine(true));
      j = this.rows - 1 - this.scrollBottom;
      this.lines.splice(this.rows - 1 + this.ybase - j + 1, 1);
      // this.maxRange();
      this.updateRange(this.scrollTop);
      this.updateRange(this.scrollBottom);
    }
    this.state = states.normal;
  };
};

},{"../states":57}],49:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {

  // ESC c Full Reset (RIS).
  Terminal.prototype.reset = function() {
    Terminal.call(this, this.cols, this.rows);
    this.refresh(0, this.rows - 1);
  };
};

},{}],50:[function(require,module,exports){
'use strict';
var states = require('../states');

module.exports = function (Terminal) {

  // ESC H Tab Set (HTS is 0x88).
  Terminal.prototype.tabSet = function() {
    this.tabs[this.x] = true;
    this.state = states.normal;
  };
};

},{"../states":57}],51:[function(require,module,exports){
'use strict';

// if bold is broken, we can't
// use it in the terminal.
function isBoldBroken() {
    var el = document.createElement('span');
    el.innerHTML = 'hello world';
    document.body.appendChild(el);
    var w1 = el.scrollWidth;
    el.style.fontWeight = 'bold';
    var w2 = el.scrollWidth;
    document.body.removeChild(el);
    return w1 !== w2;
}

module.exports = function (Terminal) {
  /**
  * Open Terminal
  */

  Terminal.prototype.open = function() {
    var self = this,
      i = 0,
      div;

    this.element = document.createElement('div');
    this.element.className = 'terminal';
    this.children = [];

    for (; i < this.rows; i++) {
      div = document.createElement('div');
      this.element.appendChild(div);
      this.children.push(div);
    }

    this.refresh(0, this.rows - 1);

    // XXX - hack, move this somewhere else.
    if (Terminal.brokenBold === null) {
      Terminal.brokenBold = isBoldBroken();
    }

    // sync default bg/fg colors
    this.element.style.backgroundColor = Terminal.defaultColors.bg;
    this.element.style.color = Terminal.defaultColors.fg;
  };
};

},{}],52:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {
  Terminal.termName        =  'xterm';
  Terminal.geometry        =  [80, 24];
  Terminal.cursorBlink     =  true;
  Terminal.visualBell      =  false;
  Terminal.popOnBell       =  false;
  Terminal.scrollback      =  1000;
  Terminal.screenKeys      =  false;
  Terminal.programFeatures =  false;
  Terminal.debug           =  false;
};

},{}],53:[function(require,module,exports){
'use strict';

function addRowsOnDemand () {
  while (this.y >= this.rows) {
    this.lines.push(this.blankLine());
    var div = document.createElement('div');
    this.element.appendChild(div);
    this.children.push(div);

    this.rows++;
  }
}

module.exports = function (Terminal) {
  Terminal.prototype.updateRange = function(y) {
    if (y < this.refreshStart) this.refreshStart = y;
    if (y > this.refreshEnd) this.refreshEnd = y;
    addRowsOnDemand.bind(this)();
  };

  Terminal.prototype.maxRange = function() {
    this.refreshStart = 0;
    this.refreshEnd = this.rows - 1;
  };
};

},{}],54:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {

  /**
  * Rendering Engine
  */

  // In the screen buffer, each character
  // is stored as a an array with a character
  // and a 32-bit integer.
  // First value: a utf-16 character.
  // Second value:
  // Next 9 bits: background color (0-511).
  // Next 9 bits: foreground color (0-511).
  // Next 14 bits: a mask for misc. flags:
  // 1=bold, 2=underline, 4=inverse

  Terminal.prototype.refresh = function(start, end) {
    var x, y, i, line, out, ch, width, data, attr, fgColor, bgColor, flags, row, parent;

    
    width = this.cols;
    y = start;

    for (; y <= end; y++) {
      row = y + this.ydisp;

      line = this.lines[row];
      if (!line) {
        // simple solution in case we have more lines than rows
        // could be improved to instead remove first line (and related html element)
        return this.reset();
      }

      out = '';

      if (y === this.y && this.cursorState && this.ydisp === this.ybase && !this.cursorHidden) {
        x = this.x;
      } else {
        x = -1;
      }

      attr = this.defAttr;
      i = 0;

      for (; i < width; i++) {
        data = line[i][0];
        ch = line[i][1];

        if (i === x) data = -1;

        if (data !== attr) {
          if (attr !== this.defAttr) {
            out += '</span>';
          }
          if (data !== this.defAttr) {
            if (data === -1) {
              out += '<span class="reverse-video">';
            } else {
              out += '<span style="';

              bgColor = data & 0x1ff;
              fgColor = (data >> 9) & 0x1ff;
              flags = data >> 18;

              if (flags & 1) {
                if (!Terminal.brokenBold) {
                  out += 'font-weight:bold;';
                }
                // see: XTerm*boldColors
                if (fgColor < 8) fgColor += 8;
              }

              if (flags & 2) {
                out += 'text-decoration:underline;';
              }

              if (bgColor !== 256) {
                out += 'background-color:' + Terminal.colors[bgColor] + ';';
              }

              if (fgColor !== 257) {
                out += 'color:' + Terminal.colors[fgColor] + ';';
              }

              out += '">';
            }
          }
        }

        switch (ch) {
        case '&':
          out += '&';
          break;
        case '<':
          out += '<';
          break;
        case '>':
          out += '>';
          break;
        default:
          if (ch <= ' ') {
            out += ' ';
          } else {
            out += ch;
          }
          break;
        }

        attr = data;
      }

      if (attr !== this.defAttr) {
        out += '</span>';
      }

      this.children[y].innerHTML = out;
    }

    if (parent) parent.appendChild(this.element);
  };
};

},{}],55:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {
  Terminal.prototype.setgCharset = function(g, charset) {
    this.charsets[g] = charset;
    if (this.glevel === g) {
      this.charset = charset;
    }
  };
};

},{}],56:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {
  Terminal.prototype.setgLevel = function(g) {
    this.glevel = g;
    this.charset = this.charsets[g];
  };
};

},{}],57:[function(require,module,exports){
'use strict';

module.exports = {
    normal  :  0
  , escaped :  1
  , csi     :  2
  , osc     :  3
  , charset :  4
  , dcs     :  5
  , ignore  :  6
};

},{}],58:[function(require,module,exports){
'use strict';
// ignore warnings regarging == and != (coersion makes things work here appearently)

module.exports = function (Terminal) {
  
  Terminal.prototype.setupStops = function(i) {
      if (i != null) {
          if (!this.tabs[i]) {
              i = this.prevStop(i);
          }
      } else {
          this.tabs = {};
          i = 0;
      }

      for (; i < this.cols; i += 8) {
          this.tabs[i] = true;
      }
  };

  Terminal.prototype.prevStop = function(x) {
      if (x == null) x = this.x;
      while (!this.tabs[--x] && x > 0);
      return x >= this.cols ? this.cols - 1 : x < 0 ? 0 : x;
  };

  Terminal.prototype.nextStop = function(x) {
      if (x == null) x = this.x;
      while (!this.tabs[++x] && x < this.cols);
      return x >= this.cols ? this.cols - 1 : x < 0 ? 0 : x;
  };
};

},{}],59:[function(require,module,exports){
'use strict';

module.exports = function (Terminal) {
  Terminal.prototype.ch = function(cur) {
    return cur ? [this.curAttr, ' '] : [this.defAttr, ' '];
  };

  Terminal.prototype.is = function(term) {
    var name = this.termName || Terminal.termName;
    return (name + '')
      .indexOf(term) === 0;
  };
};

},{}],60:[function(require,module,exports){
'use strict';

var states = require('./states');

function fixLinefeed(data) {
  return data.replace(/([^\r])\n/g, '$1\r\n');
}

function fixIndent(data) {
  if (!/(^|\n) /.test(data)) return data;

  // not very efficient, but works and would only become a problem
  // once we render huge amounts of data
  return data
    .split('\n')
    .map(function (line) {
      var count = 0;
      while(line.charAt(0) === ' '){
        line = line.slice(1);
        count++;
      }
      while(count--) {
        line = '&nbsp;' + line;
      }
      return line;
    })
    .join('\r\n');
}

module.exports = function(Terminal) {

  Terminal.prototype.write = function(data) {

    data = fixLinefeed(data);
    data = fixIndent(data);

    var l = data.length,
      i = 0,
      cs, ch;

    this.refreshStart = this.y;
    this.refreshEnd = this.y;

    if (this.ybase !== this.ydisp) {
      this.ydisp = this.ybase;
      this.maxRange();
    }

    // this.log(JSON.stringify(data.replace(/\x1b/g, '^[')));

    for (; i < l; i++) {
      ch = data[i];
      switch (this.state) {
      case states.normal:
        switch (ch) {
          // '\0'
          // case '\0':
          // break;

          // '\a'
        case '\x07':
          this.bell();
          break;

          // '\n', '\v', '\f'
        case '\n':
        case '\x0b':
        case '\x0c':
          if (this.convertEol) {
            this.x = 0;
          }
          this.y++;
          break;

          // '\r'
        case '\r':
          this.x = 0;
          break;

          // '\b'
        case '\x08':
          if (this.x > 0) {
            this.x--;
          }
          break;

          // '\t'
        case '\t':
          this.x = this.nextStop();
          break;

          // shift out
        case '\x0e':
          this.setgLevel(1);
          break;

          // shift in
        case '\x0f':
          this.setgLevel(0);
          break;

          // '\e'
        case '\x1b':
          this.state = states.escaped;
          break;

        default:
          // ' '
          if (ch >= ' ') {
            if (this.charset && this.charset[ch]) {
              ch = this.charset[ch];
            }
            if (this.x >= this.cols) {
              this.x = 0;
              this.y++;
            }

            // FIXME: this prevents errors from being thrown, but needs a proper fix
            if (this.lines[this.y + this.ybase])
              this.lines[this.y + this.ybase][this.x] = [this.curAttr, ch];

            this.x++;
            this.updateRange(this.y);
          }
          break;
        }
        break;
      case states.escaped:
        switch (ch) {
          // ESC [ Control Sequence Introducer ( CSI is 0x9b).
        case '[':
          this.params = [];
          this.currentParam = 0;
          this.state = states.csi;
          break;

          // ESC ] Operating System Command ( OSC is 0x9d).
        case ']':
          this.params = [];
          this.currentParam = 0;
          this.state = states.osc;
          break;

          // ESC P Device Control String ( DCS is 0x90).
        case 'P':
          this.params = [];
          this.currentParam = 0;
          this.state = states.dcs;
          break;

          // ESC _ Application Program Command ( APC is 0x9f).
        case '_':
          this.stateType = 'apc';
          this.state = states.ignore;
          break;

          // ESC ^ Privacy Message ( PM is 0x9e).
        case '^':
          this.stateType = 'pm';
          this.state = states.ignore;
          break;

          // ESC c Full Reset (RIS).
        case 'c':
          this.reset();
          break;

          // ESC E Next Line ( NEL is 0x85).
          // ESC D Index ( IND is 0x84).
        case 'E':
          this.x = 0;
          break;
        case 'D':
          this.index();
          break;

          // ESC M Reverse Index ( RI is 0x8d).
        case 'M':
          this.reverseIndex();
          break;

          // ESC % Select default/utf-8 character set.
          // @ = default, G = utf-8
        case '%':
          //this.charset = null;
          this.setgLevel(0);
          this.setgCharset(0, Terminal.charsets.US);
          this.state = states.normal;
          i++;
          break;

          // ESC (,),*,+,-,. Designate G0-G2 Character Set.
        case '(':
          // <-- this seems to get all the attention
        case ')':
        case '*':
        case '+':
        case '-':
        case '.':
          switch (ch) {
          case '(':
            this.gcharset = 0;
            break;
          case ')':
            this.gcharset = 1;
            break;
          case '*':
            this.gcharset = 2;
            break;
          case '+':
            this.gcharset = 3;
            break;
          case '-':
            this.gcharset = 1;
            break;
          case '.':
            this.gcharset = 2;
            break;
          }
          this.state = states.charset;
          break;

          // Designate G3 Character Set (VT300).
          // A = ISO Latin-1 Supplemental.
          // Not implemented.
        case '/':
          this.gcharset = 3;
          this.state = states.charset;
          i--;
          break;

          // ESC N
          // Single Shift Select of G2 Character Set
          // ( SS2 is 0x8e). This affects next character only.
        case 'N':
          break;
          // ESC O
          // Single Shift Select of G3 Character Set
          // ( SS3 is 0x8f). This affects next character only.
        case 'O':
          break;
          // ESC n
          // Invoke the G2 Character Set as GL (LS2).
        case 'n':
          this.setgLevel(2);
          break;
          // ESC o
          // Invoke the G3 Character Set as GL (LS3).
        case 'o':
          this.setgLevel(3);
          break;
          // ESC |
          // Invoke the G3 Character Set as GR (LS3R).
        case '|':
          this.setgLevel(3);
          break;
          // ESC }
          // Invoke the G2 Character Set as GR (LS2R).
        case '}':
          this.setgLevel(2);
          break;
          // ESC ~
          // Invoke the G1 Character Set as GR (LS1R).
        case '~':
          this.setgLevel(1);
          break;

          // ESC 7 Save Cursor (DECSC).
        case '7':
          this.saveCursor();
          this.state = states.normal;
          break;

          // ESC 8 Restore Cursor (DECRC).
        case '8':
          this.restoreCursor();
          this.state = states.normal;
          break;

          // ESC # 3 DEC line height/width
        case '#':
          this.state = states.normal;
          i++;
          break;

          // ESC H Tab Set (HTS is 0x88).
        case 'H':
          this.tabSet();
          break;

          // ESC = Application Keypad (DECPAM).
        case '=':
          this.log('Serial port requested application keypad.');
          this.applicationKeypad = true;
          this.state = states.normal;
          break;

          // ESC > Normal Keypad (DECPNM).
        case '>':
          this.log('Switching back to normal keypad.');
          this.applicationKeypad = false;
          this.state = states.normal;
          break;

        default:
          this.state = states.normal;
          this.error('Unknown ESC control: %s.', ch);
          break;
        }
        break;

      case states.charset:
        switch (ch) {
        case '0':
          // DEC Special Character and Line Drawing Set.
          cs = Terminal.charsets.SCLD;
          break;
        case 'A':
          // UK
          cs = Terminal.charsets.UK;
          break;
        case 'B':
          // United States (USASCII).
          cs = Terminal.charsets.US;
          break;
        case '4':
          // Dutch
          cs = Terminal.charsets.Dutch;
          break;
        case 'C':
          // Finnish
        case '5':
          cs = Terminal.charsets.Finnish;
          break;
        case 'R':
          // French
          cs = Terminal.charsets.French;
          break;
        case 'Q':
          // FrenchCanadian
          cs = Terminal.charsets.FrenchCanadian;
          break;
        case 'K':
          // German
          cs = Terminal.charsets.German;
          break;
        case 'Y':
          // Italian
          cs = Terminal.charsets.Italian;
          break;
        case 'E':
          // NorwegianDanish
        case '6':
          cs = Terminal.charsets.NorwegianDanish;
          break;
        case 'Z':
          // Spanish
          cs = Terminal.charsets.Spanish;
          break;
        case 'H':
          // Swedish
        case '7':
          cs = Terminal.charsets.Swedish;
          break;
        case '=':
          // Swiss
          cs = Terminal.charsets.Swiss;
          break;
        case '/':
          // ISOLatin (actually /A)
          cs = Terminal.charsets.ISOLatin;
          i++;
          break;
        default:
          // Default
          cs = Terminal.charsets.US;
          break;
        }
        this.setgCharset(this.gcharset, cs);
        this.gcharset = null;
        this.state = states.normal;
        break;

      case states.osc:
        // OSC Ps ; Pt ST
        // OSC Ps ; Pt BEL
        // Set Text Parameters.
        if (ch === '\x1b' || ch === '\x07') {
          if (ch === '\x1b') i++;

          this.params.push(this.currentParam);

          switch (this.params[0]) {
          case 0:
          case 1:
          case 2:
            if (this.params[1]) {
              this.title = this.params[1];
              this.handleTitle(this.title);
            }
            break;
          case 3:
            // set X property
            break;
          case 4:
          case 5:
            // change dynamic colors
            break;
          case 10:
          case 11:
          case 12:
          case 13:
          case 14:
          case 15:
          case 16:
          case 17:
          case 18:
          case 19:
            // change dynamic ui colors
            break;
          case 46:
            // change log file
            break;
          case 50:
            // dynamic font
            break;
          case 51:
            // emacs shell
            break;
          case 52:
            // manipulate selection data
            break;
          case 104:
          case 105:
          case 110:
          case 111:
          case 112:
          case 113:
          case 114:
          case 115:
          case 116:
          case 117:
          case 118:
            // reset colors
            break;
          }

          this.params = [];
          this.currentParam = 0;
          this.state = states.normal;
        } else {
          if (!this.params.length) {
            if (ch >= '0' && ch <= '9') {
              this.currentParam = this.currentParam * 10 + ch.charCodeAt(0) - 48;
            } else if (ch === ';') {
              this.params.push(this.currentParam);
              this.currentParam = '';
            }
          } else {
            this.currentParam += ch;
          }
        }
        break;

      case states.csi:
        // '?', '>', '!'
        if (ch === '?' || ch === '>' || ch === '!') {
          this.prefix = ch;
          break;
        }

        // 0 - 9
        if (ch >= '0' && ch <= '9') {
          this.currentParam = this.currentParam * 10 + ch.charCodeAt(0) - 48;
          break;
        }

        // '$', '"', ' ', '\''
        if (ch === '$' || ch === '"' || ch === ' ' || ch === '\'') {
          this.postfix = ch;
          break;
        }

        this.params.push(this.currentParam);
        this.currentParam = 0;

        // ';'
        if (ch === ';') break;

        this.state = states.normal;

        switch (ch) {
          // CSI Ps A
          // Cursor Up Ps Times (default = 1) (CUU).
        case 'A':
          this.cursorUp(this.params);
          break;

          // CSI Ps B
          // Cursor Down Ps Times (default = 1) (CUD).
        case 'B':
          this.cursorDown(this.params);
          break;

          // CSI Ps C
          // Cursor Forward Ps Times (default = 1) (CUF).
        case 'C':
          this.cursorForward(this.params);
          break;

          // CSI Ps D
          // Cursor Backward Ps Times (default = 1) (CUB).
        case 'D':
          this.cursorBackward(this.params);
          break;

          // CSI Ps ; Ps H
          // Cursor Position [row;column] (default = [1,1]) (CUP).
        case 'H':
          this.cursorPos(this.params);
          break;

          // CSI Ps J Erase in Display (ED).
        case 'J':
          this.eraseInDisplay(this.params);
          break;

          // CSI Ps K Erase in Line (EL).
        case 'K':
          this.eraseInLine(this.params);
          break;

          // CSI Pm m Character Attributes (SGR).
        case 'm':
          this.charAttributes(this.params);
          break;

          // CSI Ps n Device Status Report (DSR).
        case 'n':
          this.deviceStatus(this.params);
          break;

          /**
          * Additions
          */

          // CSI Ps @
          // Insert Ps (Blank) Character(s) (default = 1) (ICH).
        case '@':
          this.insertChars(this.params);
          break;

          // CSI Ps E
          // Cursor Next Line Ps Times (default = 1) (CNL).
        case 'E':
          this.cursorNextLine(this.params);
          break;

          // CSI Ps F
          // Cursor Preceding Line Ps Times (default = 1) (CNL).
        case 'F':
          this.cursorPrecedingLine(this.params);
          break;

          // CSI Ps G
          // Cursor Character Absolute [column] (default = [row,1]) (CHA).
        case 'G':
          this.cursorCharAbsolute(this.params);
          break;

          // CSI Ps L
          // Insert Ps Line(s) (default = 1) (IL).
        case 'L':
          this.insertLines(this.params);
          break;

          // CSI Ps M
          // Delete Ps Line(s) (default = 1) (DL).
        case 'M':
          this.deleteLines(this.params);
          break;

          // CSI Ps P
          // Delete Ps Character(s) (default = 1) (DCH).
        case 'P':
          this.deleteChars(this.params);
          break;

          // CSI Ps X
          // Erase Ps Character(s) (default = 1) (ECH).
        case 'X':
          this.eraseChars(this.params);
          break;

          // CSI Pm ` Character Position Absolute
          // [column] (default = [row,1]) (HPA).
        case '`':
          this.charPosAbsolute(this.params);
          break;

          // 141 61 a * HPR -
          // Horizontal Position Relative
        case 'a':
          this.HPositionRelative(this.params);
          break;

          // CSI P s c
          // Send Device Attributes (Primary DA).
          // CSI > P s c
          // Send Device Attributes (Secondary DA)
        case 'c':
          //- this.sendDeviceAttributes(this.params);
          break;

          // CSI Pm d
          // Line Position Absolute [row] (default = [1,column]) (VPA).
        case 'd':
          this.linePosAbsolute(this.params);
          break;

          // 145 65 e * VPR - Vertical Position Relative
        case 'e':
          this.VPositionRelative(this.params);
          break;

          // CSI Ps ; Ps f
          // Horizontal and Vertical Position [row;column] (default =
          // [1,1]) (HVP).
        case 'f':
          this.HVPosition(this.params);
          break;

          // CSI Pm h Set Mode (SM).
          // CSI ? Pm h - mouse escape codes, cursor escape codes
        case 'h':
          //- this.setMode(this.params);
          break;

          // CSI Pm l Reset Mode (RM).
          // CSI ? Pm l
        case 'l':
          //- this.resetMode(this.params);
          break;

          // CSI Ps ; Ps r
          // Set Scrolling Region [top;bottom] (default = full size of win-
          // dow) (DECSTBM).
          // CSI ? Pm r
        case 'r':
          //- this.setScrollRegion(this.params);
          break;

          // CSI s
          // Save cursor (ANSI.SYS).
        case 's':
          this.saveCursor(this.params);
          break;

          // CSI u
          // Restore cursor (ANSI.SYS).
        case 'u':
          this.restoreCursor(this.params);
          break;

          /**
          * Lesser Used
          */

          // CSI Ps I
          // Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
        case 'I':
          this.cursorForwardTab(this.params);
          break;

          // CSI Ps S Scroll up Ps lines (default = 1) (SU).
        case 'S':
          //- this.scrollUp(this.params);
          break;

          // CSI Ps T Scroll down Ps lines (default = 1) (SD).
          // CSI Ps ; Ps ; Ps ; Ps ; Ps T
          // CSI > Ps; Ps T
        case 'T':
          if (this.params.length < 2 && !this.prefix) {
            //- this.scrollDown(this.params);
          }
          break;

          // CSI Ps Z
          // Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
        case 'Z':
          this.cursorBackwardTab(this.params);
          break;

          // CSI Ps b Repeat the preceding graphic character Ps times (REP).
        case 'b':
          this.repeatPrecedingCharacter(this.params);
          break;

          // CSI Ps g Tab Clear (TBC).
        case 'g':
          this.tabClear(this.params);
          break;
        case 'p':
          switch (this.prefix) {
          case '!':
            this.softReset(this.params);
            break;
          }
          break;

        default:
          this.error('Unknown CSI code: %s.', ch);
          break;
        }

        this.prefix = '';
        this.postfix = '';
        break;

      case states.dcs:
        if (ch === '\x1b' || ch === '\x07') {
          if (ch === '\x1b') i++;

          switch (this.prefix) {
            // User-Defined Keys (DECUDK).
          case '':
            break;

            // Request Status String (DECRQSS).
            // test: echo -e '\eP$q"p\e\\'
          case '$q':
            var pt = this.currentParam,
              valid = false;

            switch (pt) {
              // DECSCA
            case '"q':
              pt = '0"q';
              break;

              // DECSCL
            case '"p':
              pt = '61"p';
              break;

              // DECSTBM
            case 'r':
              pt = '' + (this.scrollTop + 1) + ';' + (this.scrollBottom + 1) + 'r';
              break;

              // SGR
            case 'm':
              pt = '0m';
              break;

            default:
              this.error('Unknown DCS Pt: %s.', pt);
              pt = '';
              break;
            }

            //- this.send('\x1bP' + valid + '$r' + pt + '\x1b\\');
            break;

            // Set Termcap/Terminfo Data (xterm, experimental).
          case '+p':
            break;

          default:
            this.error('Unknown DCS prefix: %s.', this.prefix);
            break;
          }

          this.currentParam = 0;
          this.prefix = '';
          this.state = states.normal;
        } else if (!this.currentParam) {
          if (!this.prefix && ch !== '$' && ch !== '+') {
            this.currentParam = ch;
          } else if (this.prefix.length === 2) {
            this.currentParam = ch;
          } else {
            this.prefix += ch;
          }
        } else {
          this.currentParam += ch;
        }
        break;

      case states.ignore:
        // For PM and APC.
        if (ch === '\x1b' || ch === '\x07') {
          if (ch === '\x1b') i++;
          this.stateData = '';
          this.state = states.normal;
        } else {
          if (!this.stateData) this.stateData = '';
          this.stateData += ch;
        }
        break;
      }
    }

    this.updateRange(this.y);
    this.refresh(this.refreshStart, this.refreshEnd);
  };

  Terminal.prototype.writeln = function(data) {
    // at times spaces appear in between escape chars and fixIndent fails us, so we fix it here
    data = data.replace(/ /g, '&nbsp;');
    // adding empty char before line break ensures that empty lines render properly
    this.write(data + ' \r\n');
  };
};

},{"./states":57}],61:[function(require,module,exports){
'use strict';

var states = require('./lib/states');

module.exports = Terminal;

function Terminal(opts) {
  opts = opts || {};
  if (!(this instanceof Terminal)) return new Terminal(opts);

  this.cols = opts.cols || 500;
  this.rows = opts.rows || 100;

  this.ybase = 0;
  this.ydisp = 0;
  this.x = 0;
  this.y = 0;
  this.cursorState = 0;
  this.cursorHidden = false;
  this.convertEol = false;
  this.state = states.normal;
  this.queue = '';
  this.scrollTop = 0;
  this.scrollBottom = this.rows - 1;

  // modes
  this.applicationKeypad = false;
  this.originMode = false;
  this.insertMode = false;
  this.wraparoundMode = false;
  this.normal = null;

  // charset
  this.charset = null;
  this.gcharset = null;
  this.glevel = 0;
  this.charsets = [null];

  // misc
  this.element;
  this.children;
  this.refreshStart;
  this.refreshEnd;
  this.savedX;
  this.savedY;
  this.savedCols;

  // stream
  this.readable = true;
  this.writable = true;

  this.defAttr = (257 << 9) | 256;
  this.curAttr = this.defAttr;

  this.params = [];
  this.currentParam = 0;
  this.prefix = '';
  this.postfix = '';

  this.lines = [];
  var i = this.rows;
  while (i--) {
      this.lines.push(this.blankLine());
  }

  this.tabs;
  this.setupStops();
}

require('./lib/colors')(Terminal);
require('./lib/options')(Terminal);

require('./lib/open')(Terminal);
require('./lib/destroy')(Terminal);
require('./lib/refresh')(Terminal);

require('./lib/write')(Terminal);

require('./lib/setgLevel');
require('./lib/setgCharset');

require('./lib/debug')(Terminal);

require('./lib/stops')(Terminal);

require('./lib/erase')(Terminal);
require('./lib/blankLine')(Terminal);
require('./lib/range')(Terminal);
require('./lib/util')(Terminal);

require('./lib/esc/index.js')(Terminal);
require('./lib/esc/reset.js')(Terminal);
require('./lib/esc/tabSet.js')(Terminal);

require('./lib/csi/charAttributes')(Terminal);
require('./lib/csi/insert-delete')(Terminal);
require('./lib/csi/position')(Terminal);
require('./lib/csi/cursor')(Terminal);
require('./lib/csi/repeatPrecedingCharacter')(Terminal);
require('./lib/csi/tabClear')(Terminal);
require('./lib/csi/softReset')(Terminal);

require('./lib/charsets.js')(Terminal);

},{"./lib/blankLine":35,"./lib/charsets.js":36,"./lib/colors":37,"./lib/csi/charAttributes":38,"./lib/csi/cursor":39,"./lib/csi/insert-delete":40,"./lib/csi/position":41,"./lib/csi/repeatPrecedingCharacter":42,"./lib/csi/softReset":43,"./lib/csi/tabClear":44,"./lib/debug":45,"./lib/destroy":46,"./lib/erase":47,"./lib/esc/index.js":48,"./lib/esc/reset.js":49,"./lib/esc/tabSet.js":50,"./lib/open":51,"./lib/options":52,"./lib/range":53,"./lib/refresh":54,"./lib/setgCharset":55,"./lib/setgLevel":56,"./lib/states":57,"./lib/stops":58,"./lib/util":59,"./lib/write":60}],62:[function(require,module,exports){
module.exports=require(31)
},{"FWaASH":69,"stream":83}],63:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  if (encoding === 'base64' && type === 'string') {
    subject = base64clean(subject)
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str.toString()
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.compare = function (a, b) {
  assert(Buffer.isBuffer(a) && Buffer.isBuffer(b), 'Arguments must be Buffers')
  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) {
    return -1
  }
  if (y < x) {
    return 1
  }
  return 0
}

// BUFFER INSTANCE METHODS
// =======================

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end === undefined) ? self.length : Number(end)

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = asciiSlice(self, start, end)
      break
    case 'binary':
      ret = binarySlice(self, start, end)
      break
    case 'base64':
      ret = base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

Buffer.prototype.equals = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.compare = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return readUInt16(this, offset, false, noAssert)
}

function readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return readInt16(this, offset, false, noAssert)
}

function readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return readInt32(this, offset, false, noAssert)
}

function readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return readFloat(this, offset, false, noAssert)
}

function readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
  return offset + 1
}

function writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
  return offset + 2
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, false, noAssert)
}

function writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
  return offset + 4
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
  return offset + 1
}

function writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
  return offset + 2
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, false, noAssert)
}

function writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
  return offset + 4
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, false, noAssert)
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":64,"ieee754":65}],64:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],65:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],66:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],67:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],68:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require("FWaASH"))
},{"FWaASH":69}],69:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],70:[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":71}],71:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

module.exports = Duplex;

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
/*</replacement>*/


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

forEach(objectKeys(Writable.prototype), function(method) {
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
});

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  process.nextTick(this.end.bind(this));
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

}).call(this,require("FWaASH"))
},{"./_stream_readable":73,"./_stream_writable":75,"FWaASH":69,"core-util-is":76,"inherits":67}],72:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./_stream_transform":74,"core-util-is":76,"inherits":67}],73:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events').EventEmitter;

/*<replacement>*/
if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

var Stream = require('stream');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var StringDecoder;

util.inherits(Readable, Stream);

function ReadableState(options, stream) {
  options = options || {};

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = false;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // In streams that never have any data, and do push(null) right away,
  // the consumer can miss the 'end' event if they do some I/O before
  // consuming the stream.  So, we don't emit('end') until some reading
  // happens.
  this.calledRead = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;


  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (typeof chunk === 'string' && !state.objectMode) {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null || chunk === undefined) {
    state.reading = false;
    if (!state.ended)
      onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      // update the buffer info.
      state.length += state.objectMode ? 1 : chunk.length;
      if (addToFront) {
        state.buffer.unshift(chunk);
      } else {
        state.reading = false;
        state.buffer.push(chunk);
      }

      if (state.needReadable)
        emitReadable(stream);

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}



// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
};

// Don't raise the hwm > 128MB
var MAX_HWM = 0x800000;
function roundUpToNextPowerOf2(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (isNaN(n) || n === null) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = roundUpToNextPowerOf2(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else
      return state.length;
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  var state = this._readableState;
  state.calledRead = true;
  var nOrig = n;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;

  // if we currently have less than the highWaterMark, then also read some
  if (state.length - n <= state.highWaterMark)
    doRead = true;

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading)
    doRead = false;

  if (doRead) {
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read called its callback synchronously, then `reading`
  // will be false, and we need to re-evaluate how much data we
  // can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we happened to read() exactly the remaining amount in the
  // buffer, and the EOF has been seen at this point, then make sure
  // that we emit 'end' on the very next tick.
  if (state.ended && !state.endEmitted && state.length === 0)
    endReadable(this);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode &&
      !er) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.decoder && !state.ended) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // if we've ended and we have some data left, then emit
  // 'readable' now to make sure it gets picked up.
  if (state.length > 0)
    emitReadable(stream);
  else
    endReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (state.emittedReadable)
    return;

  state.emittedReadable = true;
  if (state.sync)
    process.nextTick(function() {
      emitReadable_(stream);
    });
  else
    emitReadable_(stream);
}

function emitReadable_(stream) {
  stream.emit('readable');
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    process.nextTick(function() {
      maybeReadMore_(stream, state);
    });
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    process.nextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    if (readable !== src) return;
    cleanup();
  }

  function onend() {
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (!dest._writableState || dest._writableState.needDrain)
      ondrain();
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    unpipe();
    dest.removeListener('error', onerror);
    if (EE.listenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];



  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    // the handler that waits for readable events after all
    // the data gets sucked out in flow.
    // This would be easier to follow with a .once() handler
    // in flow(), but that is too slow.
    this.on('readable', pipeOnReadable);

    state.flowing = true;
    process.nextTick(function() {
      flow(src);
    });
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var dest = this;
    var state = src._readableState;
    state.awaitDrain--;
    if (state.awaitDrain === 0)
      flow(src);
  };
}

function flow(src) {
  var state = src._readableState;
  var chunk;
  state.awaitDrain = 0;

  function write(dest, i, list) {
    var written = dest.write(chunk);
    if (false === written) {
      state.awaitDrain++;
    }
  }

  while (state.pipesCount && null !== (chunk = src.read())) {

    if (state.pipesCount === 1)
      write(state.pipes, 0, null);
    else
      forEach(state.pipes, write);

    src.emit('data', chunk);

    // if anyone needs a drain, then we have to wait for that.
    if (state.awaitDrain > 0)
      return;
  }

  // if every destination was unpiped, either before entering this
  // function, or in the while loop, then stop flowing.
  //
  // NB: This is a pretty rare edge case.
  if (state.pipesCount === 0) {
    state.flowing = false;

    // if there were data event listeners added, then switch to old mode.
    if (EE.listenerCount(src, 'data') > 0)
      emitDataEvents(src);
    return;
  }

  // at this point, no one needed a drain, so we just ran out of data
  // on the next readable event, start it over again.
  state.ranOut = true;
}

function pipeOnReadable() {
  if (this._readableState.ranOut) {
    this._readableState.ranOut = false;
    flow(this);
  }
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data' && !this._readableState.flowing)
    emitDataEvents(this);

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        this.read(0);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  emitDataEvents(this);
  this.read(0);
  this.emit('resume');
};

Readable.prototype.pause = function() {
  emitDataEvents(this, true);
  this.emit('pause');
};

function emitDataEvents(stream, startPaused) {
  var state = stream._readableState;

  if (state.flowing) {
    // https://github.com/isaacs/readable-stream/issues/16
    throw new Error('Cannot switch to old mode now.');
  }

  var paused = startPaused || false;
  var readable = false;

  // convert to an old-style stream.
  stream.readable = true;
  stream.pipe = Stream.prototype.pipe;
  stream.on = stream.addListener = Stream.prototype.on;

  stream.on('readable', function() {
    readable = true;

    var c;
    while (!paused && (null !== (c = stream.read())))
      stream.emit('data', c);

    if (c === null) {
      readable = false;
      stream._readableState.needReadable = true;
    }
  });

  stream.pause = function() {
    paused = true;
    this.emit('pause');
  };

  stream.resume = function() {
    paused = false;
    if (readable)
      process.nextTick(function() {
        stream.emit('readable');
      });
    else
      this.read(0);
    this.emit('resume');
  };

  // now make it start, just in case it hadn't already.
  stream.emit('readable');
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    if (state.decoder)
      chunk = state.decoder.write(chunk);
    if (!chunk || !state.objectMode && !chunk.length)
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (typeof stream[i] === 'function' &&
        typeof this[i] === 'undefined') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};



// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted && state.calledRead) {
    state.ended = true;
    process.nextTick(function() {
      // Check that we didn't get one last unshift.
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit('end');
      }
    });
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require("FWaASH"))
},{"FWaASH":69,"buffer":63,"core-util-is":76,"events":66,"inherits":67,"isarray":77,"stream":83,"string_decoder/":78}],74:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.


// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(options, stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined)
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  var ts = this._transformState = new TransformState(options, this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  this.once('finish', function() {
    if ('function' === typeof this._flush)
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var rs = stream._readableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":71,"core-util-is":76,"inherits":67}],75:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

module.exports = Writable;

/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/


var Stream = require('stream');

util.inherits(Writable, Stream);

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
}

function WritableState(options, stream) {
  options = options || {};

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.buffer = [];

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

function Writable(options) {
  var Duplex = require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, state, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  process.nextTick(function() {
    cb(er);
  });
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    process.nextTick(function() {
      cb(er);
    });
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = function() {};

  if (state.ended)
    writeAfterEnd(this, state, cb);
  else if (validChunk(this, state, chunk, cb))
    ret = writeOrBuffer(this, state, chunk, encoding, cb);

  return ret;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);
  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing)
    state.buffer.push(new WriteReq(chunk, encoding, cb));
  else
    doWrite(stream, state, len, chunk, encoding, cb);

  return ret;
}

function doWrite(stream, state, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  if (sync)
    process.nextTick(function() {
      cb(er);
    });
  else
    cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(stream, state);

    if (!finished && !state.bufferProcessing && state.buffer.length)
      clearBuffer(stream, state);

    if (sync) {
      process.nextTick(function() {
        afterWrite(stream, state, finished, cb);
      });
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  cb();
  if (finished)
    finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;

  for (var c = 0; c < state.buffer.length; c++) {
    var entry = state.buffer[c];
    var chunk = entry.chunk;
    var encoding = entry.encoding;
    var cb = entry.callback;
    var len = state.objectMode ? 1 : chunk.length;

    doWrite(stream, state, len, chunk, encoding, cb);

    // if we didn't call the onwrite immediately, then
    // it means that we need to wait until it does.
    // also, that means that the chunk and cb are currently
    // being processed, so move the buffer counter past them.
    if (state.writing) {
      c++;
      break;
    }
  }

  state.bufferProcessing = false;
  if (c < state.buffer.length)
    state.buffer = state.buffer.slice(c);
  else
    state.buffer.length = 0;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (typeof chunk !== 'undefined' && chunk !== null)
    this.write(chunk, encoding);

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(stream, state) {
  return (state.ending &&
          state.length === 0 &&
          !state.finished &&
          !state.writing);
}

function finishMaybe(stream, state) {
  var need = needFinish(stream, state);
  if (need) {
    state.finished = true;
    stream.emit('finish');
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      process.nextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

}).call(this,require("FWaASH"))
},{"./_stream_duplex":71,"FWaASH":69,"buffer":63,"core-util-is":76,"inherits":67,"stream":83}],76:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

function isBuffer(arg) {
  return Buffer.isBuffer(arg);
}
exports.isBuffer = isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}
}).call(this,require("buffer").Buffer)
},{"buffer":63}],77:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],78:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  this.charBuffer = new Buffer(6);
  this.charReceived = 0;
  this.charLength = 0;
};


StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  var offset = 0;

  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var i = (buffer.length >= this.charLength - this.charReceived) ?
                this.charLength - this.charReceived :
                buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, offset, i);
    this.charReceived += (i - offset);
    offset = i;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (i == buffer.length) return charStr;

    // otherwise cut off the characters end from the beginning of this buffer
    buffer = buffer.slice(i, buffer.length);
    break;
  }

  var lenIncomplete = this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - lenIncomplete, end);
    this.charReceived = lenIncomplete;
    end -= lenIncomplete;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    this.charBuffer.write(charStr.charAt(charStr.length - 1), this.encoding);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }

  return i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  var incomplete = this.charReceived = buffer.length % 2;
  this.charLength = incomplete ? 2 : 0;
  return incomplete;
}

function base64DetectIncompleteChar(buffer) {
  var incomplete = this.charReceived = buffer.length % 3;
  this.charLength = incomplete ? 3 : 0;
  return incomplete;
}

},{"buffer":63}],79:[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":72}],80:[function(require,module,exports){
exports = module.exports = require('./lib/_stream_readable.js');
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":71,"./lib/_stream_passthrough.js":72,"./lib/_stream_readable.js":73,"./lib/_stream_transform.js":74,"./lib/_stream_writable.js":75}],81:[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":74}],82:[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":75}],83:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":66,"inherits":67,"readable-stream/duplex.js":70,"readable-stream/passthrough.js":79,"readable-stream/readable.js":80,"readable-stream/transform.js":81,"readable-stream/writable.js":82}],84:[function(require,module,exports){
(function (process){
var tick = process.setImmediate || process.nextTick;

module.exports = function(callback){
  return function(){
    var self = this;
    var args = arguments;
    tick(function(){
      callback.apply(self, args);
    });
  };
};
}).call(this,require("FWaASH"))
},{"FWaASH":69}],85:[function(require,module,exports){
module.exports=require(31)
},{"FWaASH":69,"stream":83}]},{},[1])