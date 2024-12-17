const express = require('express')
const router = express.Router(null)
var Airtable = require('airtable')
const https = require('https')
const fs = require('fs')
const path = require('path')
Airtable.configure({
	endpointUrl: 'https://api.airtable.com',
	apiKey: process.env.AIRTABLE_API_TOKEN_VVINSIDER,
})
var base = Airtable.base('appdfoMlUc5t6ZaVG')

const singleItemArrayToString = (array) => {
	if (array && Array.isArray(array) && array.length > 0) {
		return array[0]
	}
	return array
}

router.get('/updateItineraryData', (req, res) => {
	base('Sailings')
		.select({
			view: 'Data',
		})
		.all()
		.then((records) => {
			const data = records.map((record) => ({
				name: record.get('Name'),
				ship: singleItemArrayToString(record.get('Ship')),
				date: record.get('SailDate'),
				nights: record.get('Nights'),
				itinerary: singleItemArrayToString(record.get('Itinerary')),
				shipCode: singleItemArrayToString(record.get('ShipCode')),
				id: record.get('VoyageID'),
				fetchedPackageCode: singleItemArrayToString(
					record.get('FetchedPackageCode')
				),
				altPackageCode: record.get('AltPackageCode'),
				packageCode: singleItemArrayToString(record.get('PackageCode')),
				urls: {
					group: record.get('GroupURL'),
					store: record.get('StoreURL'),
					book: record.get('BookURL'),
				},
			}))

			// Write the JSON data to a file
			fs.writeFileSync(
				path.join(__dirname, '../../public/itineraries.json'),
				JSON.stringify(data, null, 2),
				'utf8'
			)
			console.log('JSON file created: itineraries.json')
			// Send okay message
			res.send('JSON file created/updated successfully')
		})
		.catch((error) => {
			console.error('Error fetching Airtable records:', error)
			res.send('JSON file error')
		})
})

module.exports = router
