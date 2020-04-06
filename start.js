runGulp()

// Run gulp
function runGulp () {
  const spawn = require('cross-spawn')

  process.env['FORCE_COLOR'] = 1
  var gulp = spawn('gulp')
  gulp.stdout.pipe(process.stdout)
  gulp.stderr.pipe(process.stderr)
  process.stdin.pipe(gulp.stdin)

  gulp.on('exit', function (code) {
    console.log('gulp exited with code ' + code.toString())
  })
}
