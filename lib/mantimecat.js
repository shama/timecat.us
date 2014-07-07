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
