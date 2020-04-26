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

router.post('/verifyAppStoreReceipt', (req, res) => {
	let receiptData = req.body['_receipt-data']

	const data = JSON.stringify({
		'receipt-data': receiptData,
		password: '0e8bfb00b7294888bf17671398922470',
		'exclude-old-transactions': false,
	})

	const options = {
		hostname: 'sandbox.itunes.apple.com',
		port: 443,
		path: '/verifyReceipt',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': data.length,
		},
	}

	const request = https.request(options, (response) => {
		console.log(`statusCode: ${response.statusCode}`)

		response.on('data', (d) => {
			console.log(`data: ${d}`)
			res.send(d)
		})
	})

	request.on('error', (error) => {
		console.error(error)
	})

	request.write(data)
	request.end()
})

module.exports = router
