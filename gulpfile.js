// filepath: /Users/david/Local Repositories/microbooks-web/gulpfile.js
const gulp = require('gulp')
const del = require('del')
const sourcemaps = require('gulp-sourcemaps')
const babel = require('gulp-babel')
const concat = require('gulp-concat')
const nodemon = require('gulp-nodemon')
const fs = require('fs')
const path = require('path')
const colour = require('ansi-colors')
const log = require('fancy-log')
const sass = require('gulp-sass')(require('sass'))

const config = require('./gulp/config.json')

// Clean task
function clean() {
	return del([config.paths.public + '/*', '.port.tmp'])
}

// Compress task
function compress() {
	return gulp
		.src([config.paths.assets + 'javascripts/**'])
		.pipe(sourcemaps.init())
		.pipe(
			babel({
				presets: ['@babel/env'],
			})
		)
		.pipe(concat('app.js'))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest(config.paths.public + '/javascripts/'))
}

// Copy assets task
function copyAssets() {
	return gulp
		.src([
			'!' + config.paths.assets + 'sass{,/**/*}',
			'!' + config.paths.assets + 'javascripts{,/**/*}',
			config.paths.assets + '/**',
		])
		.pipe(gulp.dest(config.paths.public))
}

// Nodemon task
const onCrash = () => {
	log(colour.cyan('[nodemon] For missing modules try running `npm install`'))
}

const onQuit = () => {
	try {
		fs.unlinkSync(path.join(__dirname, '/../.port.tmp'))
	} catch (e) {}

	process.exit(0)
}

function server(done) {
	const stream = nodemon({
		script: 'server.js',
		watch: ['server.js', 'config.json'],
		tasks: ['lint'],
		env: { NODE_ENV: 'development' },
		done: onQuit,
	})

	stream
		.on('crash', onCrash)
		.on('quit', onQuit)
		.on('restart', () => {
			log('Server restarted!')
		})
		.on('start', () => {
			log('Server started!')
			done()
		})
}

// Sass task
function compileSass() {
	return gulp
		.src(config.paths.assets + 'sass/*.scss')
		.pipe(sourcemaps.init())
		.pipe(sass({ outputStyle: 'expanded' }).on('error', sass.logError))
		.pipe(sourcemaps.write())
		.pipe(gulp.dest(config.paths.public + '/stylesheets/'))
}

// Watch tasks
function watchSass() {
	return gulp.watch(
		config.paths.assets + 'sass/**',
		{ cwd: './' },
		gulp.series(compileSass)
	)
}

function watchAssets() {
	return gulp.watch(
		[config.paths.assets + 'images/**', config.paths.assets + 'javascripts/**'],
		{ cwd: './' },
		gulp.series(copyAssets)
	)
}

function watchJs() {
	return gulp.watch(
		config.paths.assets + 'javascripts/**',
		{ cwd: './' },
		gulp.series(compress)
	)
}

// Define tasks
gulp.task('clean', clean)
gulp.task('compress', compress)
gulp.task('copy-assets', copyAssets)
gulp.task('server', server)
gulp.task('sass', compileSass)
gulp.task('watch-sass', watchSass)
gulp.task('watch-assets', watchAssets)
gulp.task('watch-js', watchJs)
gulp.task('watch', gulp.parallel('watch-sass', 'watch-assets', 'watch-js'))

// Define the default task
gulp.task(
	'default',
	gulp.series(
		'clean',
		gulp.parallel('compress', 'copy-assets', 'sass'),
		gulp.parallel('watch', 'server')
	)
)
