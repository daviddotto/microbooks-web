const express = require('express')
const router = express.Router(null)

router.all('*', (req, res, next) => {
  req.session.data.loggedIn = req.user !== false && req.user !== undefined
  req.session.data.errors = false
  req.session.data.time = Date.now()
  req.session.data.successFlash = false
  req.session.data.fromCheck = false
  req.session.data.fatalError = false
  next()
})

module.exports = router
