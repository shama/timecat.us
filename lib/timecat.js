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
