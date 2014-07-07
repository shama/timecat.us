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