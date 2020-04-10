const express = require('express')
const router = express.Router(null)
var Airtable = require('airtable')
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

module.exports = router
