const express = require('express')
const router = express.Router(null)
var Airtable = require('airtable')
const https = require('https')
const fs = require('fs')
const path = require('path')
const AWS = require('aws-sdk')
const cron = require('node-cron')

// Configure AWS
const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_REGION,
})

Airtable.configure({
	endpointUrl: 'https://api.airtable.com',
	apiKey: process.env.AIRTABLE_API_TOKEN_VVINSIDER,
})
var base = Airtable.base('appdfoMlUc5t6ZaVG')

const shortPortAliases = {
	Piraeus: 'Athens',
	'Piraeus (Athens)': 'Athens',
	Civitavecchia: 'Rome',
	'Civitavecchia (Rome)': 'Rome',
	'Beach Club at Bimini': 'Bimini',
}

const singleItemArrayToString = (array) => {
	if (array && Array.isArray(array) && array.length > 0) {
		return array[0]
	}
	return array
}

const createShortSchedule = (string) => {
	if (string && string.includes(',')) {
		// if two items are the same in succession, merge them and add (overnight) - unless they are 'At Sea'
		const array = string.split(', ')
		const newArray = []
		let lastItem = ''
		array.forEach((item) => {
			item = shortPortAliases[item] || item
			if (item === lastItem) {
				if (item !== 'At Sea') {
					newArray[newArray.length - 1] += ' (overnight)'
				}
			} else {
				newArray.push(item)
			}
			lastItem = item
		})
		return newArray
	}

	return string
}

const createSchedule = (string) => {
	if (string && string.includes(',')) {
		return string.split(', ')
	}

	return string
}

async function updateItineraryDataFromAirtable() {
	try {
		const records = await base('Sailings')
			.select({
				view: 'Data',
			})
			.all()

		const data = records.map((record) => ({
			name: record.get('Name'),
			ship: singleItemArrayToString(record.get('ShipName')),
			shipId: singleItemArrayToString(record.get('Ship')),
			date: record.get('SailDate'),
			nights: record.get('Nights'),
			itinerary: singleItemArrayToString(record.get('Itinerary')),
			region: singleItemArrayToString(record.get('Region')),
			origin: singleItemArrayToString(record.get('OriginPort')),
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
			schedule: createSchedule(record.get('Schedule')),
			shortSchedule: createShortSchedule(record.get('ShortSchedule')),
		}))

		const params = {
			Bucket: process.env.AWS_S3_BUCKET,
			Key: 'itineraries.json',
			Body: JSON.stringify(data, null, 2),
			ContentType: 'application/json',
		}

		await s3.putObject(params).promise()
		console.log(
			`[${new Date().toISOString()}] Itinerary data updated successfully`
		)
		return true
	} catch (error) {
		console.error(
			`[${new Date().toISOString()}] Error updating itinerary data:`,
			error
		)
		return false
	}
}

cron.schedule('*/10 * * * *', () => {
	updateItineraryDataFromAirtable()
})

router.get('/updateItineraryData', async (req, res) => {
	const success = await updateItineraryDataFromAirtable()
	if (success) {
		res.status(200).send('Itinerary data updated successfully')
	} else {
		res.status(500).send('Error updating itinerary data')
	}
})

module.exports = router
