const routes = require('./routes')
const {ProfileRoute} = require('./GetProfile')
const express = require('express')
const app = express()

app.use('/', routes)
app.use('/profile', ProfileRoute)

const port = 3000

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})