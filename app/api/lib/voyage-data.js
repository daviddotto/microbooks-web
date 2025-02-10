const cabinTypes = [
	'insider',
	'sea_view',
	'sea_terrace',
	'rockstar',
	'mega_rockstar',
]

const processVoyageData = (voyageData) => {
	// Analyse the voyage pricing data
	// The pricing data is in this form:
	// the root object has a 'pricing' property which is an object;
	// the keys are currency codes; either 'USD' or 'GBP';
	// the value of each key is an object;
	// the keys inside this object are cabin types, either 'insider', 'sea_view', 'sea_terrace', 'rockstar' or 'mega_rockstar';
	// the value of each key is an object;
	// the keys inside this object are 'price' and 'nonSalePrice';
	// the value of each key is a number or null;

	// Additionally there is another property at the root of the voyageData object called 'priceHistory' which is an array of objects;
	// each object has two properties, 'timestamp' and 'pricing';
	// 'timestamp' is a date in format "2024-12-20T01:17:48.675Z" and 'pricing' is the same structure as the pricing object described above;

	// The task is to return an object that puts this information into a tabular format so it can be easily displayed in a table;
	// We can handle USD and GBP separately;

	const processPricing = (voyageData, currencyCode) => {
		const pricing = voyageData.pricing[currencyCode]
		const priceHistory = voyageData.priceHistory.map((price) => {
			return {
				timestamp: price.timestamp,
				pricing: price.pricing[currencyCode],
			}
		})
		// concat the current pricing with the price history using voyageData.updateFetched to date the most recent pricing
		const allPricingForCurrency = [
			{ pricing, timestamp: voyageData.updateFetched },
			...priceHistory,
		]
		// sort the dates with most recent last
		allPricingForCurrency.sort(
			(a, b) => new Date(a.timestamp) - new Date(b.timestamp)
		)
		// Run through the data in each cabin type and create a new property in the cabin object which will be 'priceDifference' which will be the difference between the iterated price and the price from the previous iteration. If either of these prices are null, the price difference should be null.
		cabinTypes.forEach((cabinType) => {
			allPricingForCurrency.forEach((price, index) => {
				if (!price.pricing) {
					price.pricing = {}
				}
				try {
					// Check if cabin type exists in pricing data
					if (!price.pricing[cabinType]) {
						price.pricing[cabinType] = { price: null, nonSalePrice: null }
						console.log(
							`Missing cabin type ${cabinType} for timestamp ${price.timestamp}`
						)
					}

					const previousPrice =
						index === 0
							? null
							: allPricingForCurrency[index - 1]?.pricing?.[cabinType]?.price ??
							  null
					const currentPrice = price.pricing[cabinType]?.price ?? null

					price.pricing[cabinType].priceDifference =
						previousPrice === null || currentPrice === null
							? null
							: currentPrice - previousPrice
				} catch (error) {
					console.error(
						`Error processing ${cabinType} at index ${index}:`,
						error
					)
					price.pricing[cabinType] = {
						price: null,
						nonSalePrice: null,
						priceDifference: null,
					}
				}
			})
		})
		// filter out any pricing data where all priceDifference values are 0
		let hasPriceDifference = allPricingForCurrency.filter((price) => {
			return Object.values(price.pricing).some(
				(cabin) => cabin.priceDifference !== 0
			)
		})
		// Re-sort so the most recent pricing is first
		hasPriceDifference = hasPriceDifference.reverse()
		return hasPriceDifference
	}

	const findPriceHighlights = (priceHistory, coefficient = 10) => {
		const highlights = {}

		// Get current prices
		const currentPricing = priceHistory[0]?.pricing || {}

		cabinTypes.forEach((cabinType) => {
			const currentPrice = currentPricing[cabinType]?.price

			if (currentPrice === null) return

			// Look through history for most recent higher price
			for (let i = 1; i < priceHistory.length; i++) {
				const historicalPrice = priceHistory[i]?.pricing?.[cabinType]?.price

				if (historicalPrice === null) continue

				// Calculate how much price has dropped (historical - current)
				const priceDelta = historicalPrice - currentPrice
				const percentageDrop = ((priceDelta / currentPrice) * 100).toFixed(1)

				// Absolute all values for comparison
				const absPriceDelta = Math.abs(priceDelta)
				const absPercentageDrop = Math.abs(percentageDrop)

				// If current price is lower and delta exceeds coefficient
				if (absPriceDelta > coefficient) {
					highlights[cabinType] = {
						date: priceHistory[i].timestamp,
						delta: absPriceDelta,
						percentage: absPercentageDrop,
					}
					break
				}
			}
		})

		return highlights
	}

	const voyageDataUSD = processPricing(voyageData, 'USD')

	// Generate price highlights
	const priceHighlights = {
		USD: findPriceHighlights(voyageDataUSD, 10), // $10 threshold
	}

	voyageData = {
		...voyageData,
		voyagePriceHistory: {
			USD: voyageDataUSD,
			GBP: voyageDataGBP,
		},
		voyagePriceHighlights: priceHighlights,
	}

	return voyageData
}

module.exports = processVoyageData
