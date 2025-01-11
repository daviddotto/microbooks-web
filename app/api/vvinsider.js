const express = require('express')
const router = express.Router(null)
var Airtable = require('airtable')
const https = require('https')
const fs = require('fs')
const path = require('path')
const AWS = require('aws-sdk')
const mongodb = require('mongodb')
const cron = require('node-cron')

// Configure MongoDB
const mongoUri = process.env.MONGODB_URI
const mongoClient = new mongodb.MongoClient(mongoUri)

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
			lastMongoUpdate: record.get('LastMongoDBPush'),
			lastUpdated: record.get('LastUpdated'),
			wpContentLastUpdated: record.get('WPContentLastUpdated'),
			recordId: record.id,
		}))

		// Loop through data to identify any newly updated voyages that need to be updated in MongoDB, using a margin of error of 20 second
		const updatedVoyages = data.filter((voyage) => {
			const lastMongoUpdate = new Date(voyage.lastMongoUpdate)
			const lastUpdated = new Date(voyage.lastUpdated)
			const marginOfError = 20000
			return lastUpdated - lastMongoUpdate > marginOfError
		})

		// Update MongoDB with any new or updated voyages
		// Update fields: name, date, nights, itinerary, region, origin, fetchedPackageCode, packageCode, urls - additionally, set needsContentUpdate to true where  wpContentLastUpdated is blank or false - set to false otherwise
		await mongoClient.connect()
		const db = mongoClient.db('voyagesDatabase')
		const collection = db.collection('voyages')

		const promises = updatedVoyages.map(async (voyage) => {
			const existingVoyage = await collection.findOne({ voyageId: voyage.id })

			if (existingVoyage) {
				const update = {
					$set: {
						name: voyage.name,
						date: voyage.date,
						nights: voyage.nights,
						itinerary: voyage.itinerary,
						region: voyage.region,
						origin: voyage.origin,
						shipCode: voyage.shipCode,
						fetchedPackageCode: voyage.fetchedPackageCode,
						packageCode: voyage.packageCode,
						urls: voyage.urls,
						needsContentUpdate:
							!voyage.wpContentLastUpdated ||
							voyage.wpContentLastUpdated === 'false',
					},
				}

				await collection.updateOne({ voyageId: voyage.id }, update)
			} else {
				await collection.insertOne({
					voyageId: voyage.id,
					name: voyage.name,
					date: voyage.date,
					nights: voyage.nights,
					itinerary: voyage.itinerary,
					region: voyage.region,
					origin: voyage.origin,
					shipCode: voyage.shipCode,
					fetchedPackageCode: voyage.fetchedPackageCode,
					packageCode: voyage.packageCode,
					urls: voyage.urls,
					needsContentUpdate:
						!voyage.wpContentLastUpdated ||
						voyage.wpContentLastUpdated === 'false',
				})
			}
		})

		await Promise.all(promises)

		// Helper function for delay
		const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

		// Update Airtable in batches
		const batchSize = 10
		const rateLimitDelay = 250 // 250ms = 4 requests per second

		// Process voyages in batches
		for (let i = 0; i < updatedVoyages.length; i += batchSize) {
			const batch = updatedVoyages.slice(i, i + batchSize)
			const recordIds = batch.map((voyage) => voyage.recordId)

			try {
				await base('Sailings').update(
					recordIds.map((recordId, index) => ({
						id: recordId,
						fields: {
							LastMongoDBPush: new Date().toISOString(),
						},
					}))
				)
				console.log(
					`Updated batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
						updatedVoyages.length / batchSize
					)}`
				)

				// Add delay before next batch unless it's the last one
				if (i + batchSize < updatedVoyages.length) {
					await delay(rateLimitDelay)
				}
			} catch (error) {
				console.error(
					`Error updating batch ${Math.floor(i / batchSize) + 1}:`,
					error
				)
				throw error
			}
		}

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

router.get('/voyage/:voyageId', async (req, res) => {
	const voyageId = req.params.voyageId
	const voyage = await mongoClient
		.connect()
		.then((client) => {
			const db = client.db('voyagesDatabase')
			const collection = db.collection('voyages')
			return collection.findOne({ voyageId })
		})
		.catch((error) => {
			console.error('Error fetching voyage:', error)
			return null
		})

	if (voyage) {
		res.status(200).send(voyage)
	} else {
		res.status(404).send('Voyage not found')
	}
})

module.exports = router
