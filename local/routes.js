const express = require('express')
const router = express.Router()

// middleware that is specific to this router
router.use((req, res, next) => {
    console.log('Time: ', Date.now())
    next()
})
// define the home page route
router.get('/', (req, res) => {
    res.send('MyGoLogin Services')
})
// define the about route
router.get('/about', (req, res) => {
    res.send('About MyGoLogin')
})

router.get('/users/:userId/books/:bookId', (req, res) => {
    res.jsonp(req.params)
})
// res.sendFile()

module.exports = router