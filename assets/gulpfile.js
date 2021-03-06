/**
 * init gulp plugins
 */
var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();
var map = require('map-stream');
var events = require('events');
var emitter = new events.EventEmitter();
var path = require('path');
var gutil = require('gulp-util');
var mainYarnFiles = require('main-yarn-files');
var currentTask = '';

/**
 * error reporter object (for plugins)
 */
var reportError = function (error) {
	var lineNumber = (error.lineNumber) ? 'LINE ' + error.lineNumber + ' -- ' : '';
	var pluginName = (error.plugin) ? ': ['+error.plugin+']' : '['+currentTask+']';

	plugins.notify({
		title: 'Task Failed '+pluginName,
		message: lineNumber + 'See console.'
	}).write(error);

	gutil.beep();

	var report = '';
	var chalk = gutil.colors.white.bgRed;

	report += chalk('TASK:') + pluginName+'\n';
	report += chalk('ERROR:') + ' ' + error.message + '\n';
	if (error.lineNumber) { report += chalk('LINE:') + ' ' + error.lineNumber + '\n'; }
	if (error.fileName)   { report += chalk('FILE:') + ' ' + error.fileName + '\n'; }

	console.error(report);

	this.emit('end');
}

/**
 * custom reporter for jshint-stylish
 */
var jsHintErrorReporter = function(file, cb) {

	return map(function (file, cb) {
		if (!file.jshint.success) {
			file.jshint.results.forEach(function (err) {
			if (err) {
				var msg = [
					path.basename(file.path),
					'LINE: ' + err.error.line,
					'ERROR: ' + err.error.reason
				];

				emitter.emit('error', new Error(msg.join(" - ")));
			}
		});
		}
		cb(null, file);
	});

};

/**
 * sourcemap/globs sass to css
 */
gulp.task('sass', function () {
	currentTask = 'sass';
	return gulp.src('styles/sass/screen.scss')
		.pipe(plugins.plumber({
			errorHandler: reportError
		}))
		.pipe(plugins.sourcemaps.init())
		.pipe(plugins.sassGlob())
		.pipe(plugins.sass())
		.pipe(plugins.autoprefixer({
			browsers: ['last 3 version', 'ie 9', '> 1%'],
			cascade: false
		}))
		.pipe(plugins.sourcemaps.write())
		.pipe(gulp.dest('styles'))
		.pipe(plugins.livereload());
});

/**
 * minifies css
 */
gulp.task('cssmin', function () {
	currentTask = 'cssmin';
	return gulp.src('styles/screen.css')
		.pipe(plugins.plumber({
			errorHandler: reportError
		}))
		.pipe(plugins.cleanCss())
		.pipe(plugins.rename({suffix: '.min'}))
		.pipe(gulp.dest('styles'))
});

/**
 * collects /images/sprites/*.png into retina sprite maps
 */
gulp.task('sprites', function generateSpritesheets () {
	currentTask = 'sprites';
	var spriteData = gulp.src('images/sprites/*.png')
		.pipe(plugins.plumber({
			errorHandler: reportError
		}))
		.pipe(plugins.spritesmith({
			retinaSrcFilter: 'images/sprites/*@2x.png',
			imgName: '../images/spritesheet.png',
			retinaImgName: '../images/spritesheet@2x.png',
			cssName: 'sprites.scss'
		}));
	spriteData.img.pipe(gulp.dest('images'));
	spriteData.css.pipe(gulp.dest('styles/sass/utility'));
});

/**
 * jshints js/modules/*.js
 */
gulp.task('jshint', function() {
	return gulp.src(['js/app.init.js','js/modules/**/*.js'])
		.pipe(plugins.jshint('.jshintrc'))
		.pipe(plugins.jshint.reporter('jshint-stylish'))
		.pipe(jsHintErrorReporter())
			.on('error', plugins.notify.onError(function (error) {
				return error.message;
			}
		))
		.pipe(plugins.livereload());
});

/**
 * compiles package.json dependencies into libraries.js
 */
gulp.task('yarn', function() {
	var filterJS = plugins.filter('**/*.js');
	currentTask = 'yarn';
	return gulp.src(mainYarnFiles({
		paths: {
			modulesFolder: 'node_modules',
			jsonFile: 'package.json'
		}
	}))
		.pipe(plugins.plumber({
			errorHandler: reportError
		}))
		.pipe(filterJS)
		.pipe(plugins.concat('libraries.js'))
		.pipe(gulp.dest('js'));
});

/**
 * compiles js/libraries.js with js/vendor/*.js & js/app.init.js
 */
gulp.task('compile-js', ['yarn'], function() { 
	currentTask = 'compile-js';
	return gulp.src(['js/libraries.js','js/vendor/**/*.js','js/app.init.js','js/modules/**/*.js'])
		.pipe(plugins.plumber({
			errorHandler: reportError
		}))
		.pipe(plugins.concat('app.min.js'))
		.pipe(plugins.uglify({
			compress: {
				drop_console: true
			}
		}))
		.pipe(gulp.dest('js'));
});

/**
 * injects js/modules/*.js, js/vendor/*.js, and js/app.init.js into footer.php 
 */
gulp.task('inject', function () {
	currentTask = 'inject';
	gulp.src('../footer.php')
		.pipe(plugins.plumber({
			errorHandler: reportError
		}))
		.pipe(plugins.inject(gulp.src('js/libraries.js', {read: false}), {
			starttag: '<!-- inject:yarn:{{ext}} -->',
			transform: function (filepath) {
				return '<script src="<?php echo assets_url(); ?>'+filepath+'"></script>';
			}
		}))
		.pipe(plugins.inject(gulp.src('js/app.init.js', {read: false}), {
			starttag: '<!-- inject:init:{{ext}} -->',
			transform: function (filepath) {
				return '<script src="<?php echo assets_url(); ?>'+filepath+'"></script>';
			}
		}))
		.pipe(plugins.inject(gulp.src(['js/vendor/*.js'], {read: false}), {
			starttag: '<!-- inject:vendor:{{ext}} -->',
			transform: function (filepath) {
				return '<script src="<?php echo assets_url(); ?>'+filepath+'"></script>';
			}
		}))
		.pipe(plugins.inject(gulp.src(['js/modules/*.js'], {read: false}), {
			starttag: '<!-- inject:modules:{{ext}} -->',
			transform: function (filepath) {
				return '<script src="<?php echo assets_url(); ?>'+filepath+'"></script>';
			}
		}))
		.pipe(gulp.dest('..'))
		.pipe(plugins.livereload());
});

/**
 * uses fontello.json to create font/ files and /styles/sass/vendor/icon *.scss
 */
gulp.task('fontello', function () {
	currentTask = 'fontello';
	return gulp.src('fontello.json')
		.pipe(plugins.plumber({
			errorHandler: reportError
		}))
		.pipe(plugins.fontello({
			font: 'fonts/icons',
			css: 'styles/sass/vendor/icons'
		}))
		.pipe(plugins.rename(function(file) { // we need to rename css files to scss
			if (file.extname == '.css') {
				file.extname = '.scss';
			}
		}))
		.pipe(gulp.dest('../assets/'))
});

/**
 * minifies /images/*
 */
gulp.task('imagemin', function () {
	currentTask = 'imagemin';
	gulp.src('images/*')
		.pipe(plugins.plumber({
			errorHandler: reportError
		}))
		.pipe(plugins.imagemin())
		.pipe(gulp.dest('images'))
});

/**
 * gulp watch:
 * - listens for changed .scss files in /styles/sass, then converts sass partials into css
 * - listens for changed .js files in /js/modules/, /js/vendor, and /js/, collects dependencies from package.json into /js/libraries.js, appends all js to the footer.php, jshints the /js/modules/
 * - listens for changed .php files in theme root, /templates/, and /partials/ and refreshes page
 */
gulp.task('watch', function() {
	plugins.livereload.listen();
	gulp.watch('styles/sass/**/**/**/*.scss', ['sass']);
	gulp.watch(['js/modules/*.js','js/vendor/*.js','js/*.js'], ['yarn','inject','jshint']);
	gulp.watch(['../*.php','../templates/**/*.php','../partials/**/*.php']).on('change', plugins.livereload.changed);
});

/**
 * gulp build:
 * - creates sprites from /images/sprites/
 * - grabs font icons from fontello.json
 * - creates sass from /styles/sass/
 * - cssmin: minifies css
 * - jshints the /js/modules/
 * - collects dependencies from package.json into /js/libraries.js
 * - compile-js: merges libraries.js with vendor, modules, app.init & uglifies
 * - imagemin: shrinks images
 */
gulp.task('build', ['sprites','fontello','sass','cssmin','jshint','yarn','compile-js','imagemin']);

/**
 * gulp:
 * - creates sprites from /images/sprites/
 * - grabs font icons from fontello.json
 * - creates sass from /styles/sass/
 * - jshints the /js/modules/
 * - collects dependencies from package.json into /js/libraries.js
 * - appends all js to the footer.php
 * - kicks off gulp watch
 */
gulp.task('default', ['sprites','fontello','sass','yarn','inject','jshint','watch']);