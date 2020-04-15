// Core dependencies
const path = require('path')

// Run before other code to make sure variables from .env are available
const dotEnv = require('dotenv')
dotEnv.config()

// Local dependencies
const middleware = [require('./lib/middleware/extensions/extensions.js')]
const config = require('./app/config.js')
const routes = require('./app/routes.js')
const utils = require('./lib/utils.js')
const extensions = require('./lib/extensions/extensions.js')

// NPM dependencies
const bodyParser = require('body-parser')
const express = require('express')
const nunjucks = require('nunjucks')
const sessionInCookie = require('client-sessions')
const sessionInMemory = require('express-session')
const cookieParser = require('cookie-parser')

const app = express()

// Set cookies for use in cookie banner.
app.use(cookieParser())
const handleCookies = utils.handleCookies(app)
app.use(handleCookies)

// Set up configuration variables
const env = (process.env.NODE_ENV || 'development').toLowerCase()
const useAutoStoreData = config.useAutoStoreData
const useCookieSessionStore = config.useCookieSessionStore
let useHttps = config.useHttps

useHttps = useHttps.toLowerCase()

// Force HTTPS on production.
// asking for username/password twice (for `http`, then `https`).
const isSecure = env === 'production' && useHttps === 'true'
if (isSecure) {
	app.use(utils.forceHttps)
	app.set('trust proxy', 1) // needed for secure cookies on heroku
}

middleware.forEach((func) => app.use(func))

// Set up App
let appViews = extensions.getAppViews([
	path.join(__dirname, '/app/views/'),
	path.join(__dirname, '/lib/'),
])

let nunjucksConfig = {
	autoescape: true,
	noCache: true,
	watch: false, // We are now setting this to `false` (it's by default false anyway) as having it set to `true` for production was making the tests hang
}

if (env === 'development') {
	nunjucksConfig.watch = true
}

nunjucksConfig.express = app

let nunjucksAppEnv = nunjucks.configure(appViews, nunjucksConfig)

// Add Nunjucks filters
utils.addNunjucksFilters(nunjucksAppEnv)

// Set views engine
app.set('view engine', 'html')

// Middleware to serve static assets
app.use('/public', express.static(path.join(__dirname, '/public')))

// Support for parsing data in POSTs
app.use(bodyParser.json())
app.use(
	bodyParser.urlencoded({
		extended: true,
	})
)

// Add global variable to determine if DoNotTrack is enabled.
// This indicates a user has explicitly opted-out of tracking.
// We can avoid injecting third-party scripts that do not respect this decision.
app.use(function (req, res, next) {
	// See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/DNT
	res.locals.doNotTrackEnabled = req.header('DNT') === '1'
	next()
})

// Add variables that are available in all views
app.locals.asset_path = '/public/'
app.locals.useAutoStoreData = useAutoStoreData === 'true'
app.locals.useCookieSessionStore = useCookieSessionStore === 'true'
app.locals.cookieText = config.cookieText
app.locals.serviceName = config.serviceName
// extensionConfig sets up variables used to add the scripts and stylesheets to each page.
app.locals.extensionConfig = extensions.getAppConfig()

// Session uses service name to avoid clashes with other prototypes
const sessionName = 'shc-portal'
let sessionOptions = {
	secret: sessionName,
	cookie: {
		maxAge: 1000 * 60 * 60 * 4, // 4 hours
		secure: isSecure,
	},
}

// Support session data in cookie or memory
if (useCookieSessionStore === 'true') {
	app.use(
		sessionInCookie(
			Object.assign(sessionOptions, {
				cookieName: sessionName,
				proxy: true,
				requestKey: 'session',
			})
		)
	)
} else {
	app.use(
		sessionInMemory(
			Object.assign(sessionOptions, {
				name: sessionName,
				resave: false,
				saveUninitialized: false,
			})
		)
	)
}

// Automatically store all data users enter
if (useAutoStoreData === 'true') {
	app.use(utils.autoStoreData)
	utils.addCheckedFunction(nunjucksAppEnv)
}

// Prevent search indexing
app.use(function (req, res, next) {
	// Setting headers stops pages from being indexed even if indexed pages link to them.
	next()
})

// Load routes (found in app/routes.js)
if (typeof routes !== 'function') {
	console.log(routes.bind)
	routes.bind(app)
} else {
	app.use('/', routes)
}

// Strip .html and .htm if provided
app.get(/\.html?$/i, function (req, res) {
	var path = req.path
	var parts = path.split('.')
	parts.pop()
	path = parts.join('.')
	res.redirect(path)
})

// Auto render any view that exists

// App folder routes get priority
app.get(/^([^.]+)$/, function (req, res, next) {
	utils.matchRoutes(req, res, next)
})

// Redirect all POSTs to GETs - this allows users to use POST for autoStoreData
app.post(/^\/([^.]+)$/, function (req, res) {
	res.redirect('/' + req.params[0])
})

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
	var err = new Error(`Page not found: ${req.path}`)
	err.status = 404
	next(err)
})

// Display error
app.use(function (err, req, res) {
	console.error(err.message)
	res.status(err.status || 500)
	res.send(err.message)
})

module.exports = app
