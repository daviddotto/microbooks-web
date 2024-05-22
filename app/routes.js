const express = require('express')
const router = express.Router(null)
var Airtable = require('airtable')
const https = require('https')
var base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
	'appOl2BBiMCdby3zB'
)

router.all('*', (req, res, next) => {
	req.session.data.loggedIn = req.user !== false && req.user !== undefined
	req.session.data.errors = false
	req.session.data.time = Date.now()
	req.session.data.successFlash = false
	req.session.data.fromCheck = false
	req.session.data.fatalError = false
	next()
})

router.post('/support-handler', (req, res) => {
	base('Website responses').create(
		[
			{
				fields: {
					'Email address': req.body['_email'],
					Message: req.body['_message'],
				},
			},
		],
		function (err, records) {
			if (err) {
				console.error(err)
				res.redirect('/support')
				return
			}
			res.redirect('/support-success')
		}
	)
})

// App store receipt verification

const deferToSandboxVerification = (res, req, data, options) => {
	console.log(`body: ${JSON.stringify(req.body)}`)

	options.hostname = 'sandbox.itunes.apple.com'

	const request = https.request(options, (response) => {
		var body = ''

		console.log(`statusCode: ${response.statusCode}`)

		response.on('data', (chunk) => {
			body += chunk
		})

		response.on('end', function () {
			var jsonResponse = JSON.parse(body)
			res.setHeader('content-type', 'application/json')
			console.log(`sending: ${JSON.stringify(jsonResponse)}`)
			res.send(jsonResponse)
		})
	})

	request.on('error', (error) => {
		console.error(error)
	})

	request.write(data)
	request.end()
}

router.post('/verifyAppStoreReceipt', (req, res) => {
	let receiptData = req.body['_receipt-data']

	const data = JSON.stringify({
		'receipt-data': receiptData,
		password: '0e8bfb00b7294888bf17671398922470',
		'exclude-old-transactions': false,
	})

	console.log(`body: ${JSON.stringify(req.body)}`)

	const options = {
		hostname: 'buy.itunes.apple.com',
		port: 443,
		path: '/verifyReceipt',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': data.length,
		},
	}

	const request = https.request(options, (response) => {
		var body = ''

		console.log(`statusCode: ${response.statusCode}`)

		if (response.statusCode == 21007) {
			deferToSandboxVerification(res, req, data, options)
			return
		}

		response.on('data', (chunk) => {
			body += chunk
		})

		response.on('end', function () {
			var jsonResponse = JSON.parse(body)
			if (jsonResponse['status'] == 21007) {
				deferToSandboxVerification(res, req, data, options)
				return
			} else {
				res.setHeader('content-type', 'application/json')
				console.log(`sending: ${JSON.stringify(jsonResponse)}`)
				res.send(jsonResponse)
			}
		})
	})

	request.on('error', (error) => {
		console.error(error)
	})

	request.write(data)
	request.end()
})

const vvInsiderRoutes = require('./views/vvinsider/routes')
router.use('/vvinsider', vvInsiderRoutes)

// expose ./public/speech.mp3
router.get('/speech.mp3', (req, res) => {
	res.sendFile('speech.mp3', { root: './public' })
})

module.exports = router
