/*
  compress.js
  ===========
  compresses javascript files and copies them to public
*/

const gulp = require('gulp')
const sourcemaps = require('gulp-sourcemaps')
const babel = require('gulp-babel')
const concat = require('gulp-concat')
const config = require('./config.json')

gulp.task('compress', function () {
  return gulp
    .src([config.paths.assets + 'javascripts/**'])
    .pipe(sourcemaps.init())
    .pipe(
      babel({
        presets: ['@babel/env']
      })
    )
    .pipe(concat('app.js'))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(config.paths.public + '/javascripts/'))
})
