const express = require('express')
const router = express.Router(null)

const fs = require('fs')
const path = require('path')
const OpenAI = require('openai')

const openai = new OpenAI()

const speechFile = path.resolve('./public/speech.mp3')

router.post('/tts', async (req, res) => {
	const { message, voice } = req.body
	if (!message) {
		res.send({ success: false, error: 'No message provided' })
		return
	}
	try {
		const mp3 = await openai.audio.speech.create({
			model: 'tts-1',
			voice: voice || 'alloy',
			input: message,
		})
		const buffer = Buffer.from(await mp3.arrayBuffer())
		await fs.promises.writeFile(speechFile, buffer)
		// render the /vvinisder/tts page with a audioReady flag set to true
		res.render('vvinsider/tts', { audioReady: true })
	} catch (err) {
		// Handle the error here
		console.error(err)
	}
})

module.exports = router
