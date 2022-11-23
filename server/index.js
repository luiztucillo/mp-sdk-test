const express = require('express')
const fs = require('fs')
const path = require('path')
const app = express()
const port = 3000
const cors = require('cors')
const payment = require('./payment')

app.use(express.static(path.join(__dirname, '/public')))
app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.send(fs.readFileSync(path.join(__dirname, '/pages/index.html')))
})

app.post('/payment', async (req, res) => {
  const body = req.body;
  const response = await payment(body.amount, body.email, body.payments)
  res.send(response);
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
