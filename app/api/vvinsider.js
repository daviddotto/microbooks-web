const express = require('express')
const router = express.Router(null)
var Airtable = require('airtable')
const https = require('https')
const fs = require('fs')
const path = require('path')
const AWS = require('aws-sdk')
const mongodb = require('mongodb')
const OpenAI = require('openai')
const cron = require('node-cron')

// OpenAI configuration
const openai = new OpenAI()

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
		// Update fields: name, date, nights, itinerary, region, origin, fetchedPackageCode, packageCode, urls - additionally, set needsContentUpdate to true where  wpContentLastUpdated is blank or false or is 1/1/1970 - set to false otherwise
		await mongoClient.connect()
		const db = mongoClient.db('voyagesDatabase')
		const collection = db.collection('voyages')

		const promises = updatedVoyages.map(async (voyage) => {
			const existingVoyage = await collection.findOne({ voyageId: voyage.id })

			let needsContentUpdate = false
			if (voyage.wpContentLastUpdated) {
				let wpContentLastUpdated = new Date(voyage.wpContentLastUpdated)
				if (wpContentLastUpdated.toISOString() === '1970-01-01T00:00:00.000Z') {
					needsContentUpdate = true
				}
			} else {
				needsContentUpdate = true
			}

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
						recordId: voyage.recordId,
						needsContentUpdate,
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
					recordId: voyage.recordId,
					needsContentUpdate,
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

router.get('/generateContentFor/:voyageId', async (req, res) => {
	const voyageId = req.params.voyageId.toUpperCase()
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
		try {
			const dataForQuery = {
				name: voyage.name,
				region: voyage.region,
				origin: voyage.origin,
				ship: voyage.ship,
				date: voyage.date,
				nights: voyage.nights,
				storeUrl: voyage.urls.store,
				schedule: voyage.schedule,
			}

			const prompt =
				'Generate an informative overview of the sailing in HTML format. Include links to popular events and venues using pages from vvinsider.com based on the ship the sailing belongs to. For reference, the links to events and venues on each on the ships can be found on these pages: Scarlet Lady use "https://vvinsider.com/ship/scarlet-lady/", Valiant Lady use "https://vvinsider.com/ship/valiant-lady/", Resilient Lady use "https://vvinsider.com/ship/resilient-lady/", and Brilliant Lady use "https://vvinsider.com/ship/brilliant-lady/". Also, use vvinsider.com guides to help inform the content. The content should be unique and informative. Use the voyage schedule data provided to inform readers about the ports and stops on the voyage, evaluate (but do not include) the times to explain if the sailors have a long time / evening to enjoy the ports or if they have a short time so to choose an excursion to make the most of their limited time for example - do not include the ACTUAL times in the prose as they might change prior to the sailing and may be misleading. The schedule will be listed seperately on the page so do not list the itinerary itself in this content. Your output should be informative and factual, include great facts and must-see spots at the ports of call. Include a H2 like "Featured Places" or "Top Sights" or similar... For each port of call (excluding the origin port) include some structured bullets point content underneath about the best sights and places to visit - DO NOT include any links in this section. Around 2-4 paragraphs should be sufficient with bullet-point lists as and when appropriate for listing activities in ports for example. - Make sure the output is in HTML format, DO NOT include any Markdown. Use <b> and <i> tags for bold and italic text to emphesize important parts of the contnet. Use American English spelling.'

			const response = await openai.chat.completions.create({
				model: 'gpt-4o-mini',
				messages: [
					{
						role: 'system',
						content:
							'You are a helpful assistant that generates HTML content for voyages. This HTML content will be used in the Wordpress editor so do not include surrounding HTML tags, a H1 heading or any other structure or formatting, just the content itself, headers, links, paragraphs, ordered and unordered lists for example. Do not include pricing information as this will change on a regular basis. If there is a "store" url, this is a link to our exclusive merchendise store so include a small bit of content about the t-shirts that are for sale here - make sure the ahref is well-written to best improve our SEO. The content should not include any specific times-of-day as these might change. Try to keep the language natural and engaging without straying into overly saccharine or overly "sales-y" language. Avoid the use of too many flowery adjectives. As we a re not the actual cruise line, do not include language like "we" or "our" "join us" or "us" in the content.',
					},
					{
						role: 'user',
						content: `${prompt}\n\nVoyage Data:\n${JSON.stringify(
							dataForQuery,
							null,
							2
						)}`,
					},
				],
				max_tokens: 1500,
				n: 1,
				stop: null,
				temperature: 0.7,
			})

			let content = response.choices[0].message.content

			// add content to the voyage document in MongoDB
			await mongoClient.connect()
			const db = mongoClient.db('voyagesDatabase')
			const collection = db.collection('voyages')
			// find and update using the voyageId
			const update = {
				$set: {
					content,
					needsContentUpdate: true,
				},
			}
			await collection.updateOne({ voyageId }, update)

			// Update airtable to remove the date in WPContentLastUpdated field
			await base('Sailings').update([
				{
					id: voyage.recordId,
					fields: {
						WPContentLastUpdated: false,
					},
				},
			])

			res.status(200).send('Content generated successfully')
		} catch (error) {
			console.error('Error generating content:', error)
			res.status(500).send('Error generating content')
		}
	} else {
		res.status(404).send('Voyage not found')
	}
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
