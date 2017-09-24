var express = require('express')
var ioProm = require('express-socket.io')
var cors = require('cors')

var ColorDuration = require('./src/js/ColorDuration.js')

const app = express()
var port = process.env.PORT || 3000
var server = ioProm.init(app)

app.use(cors())

// {credentials: true, origin: 'http://localhost:8080'}
app.get('/', (req, res) => {
  res.send({status: 'success', info: {ip: req.ip, domain: req.domain}})
})

app.put('/color/:color', (req, res) => {
  ioProm.then(io => io.emit('change-color', {color: req.params.color}))

  res.send()
})

app.put('/sequence/:name', (req, res) => {
  let seq = [
    new ColorDuration('ff0000', 3),
    new ColorDuration('ff7878', 3),
    new ColorDuration('ffffff', 2),
    new ColorDuration('660099', 5),
    new ColorDuration('333333', 3)
  ]
  const setAndSchedule = (colorArray, index) => {
    colorObj = colorArray[index]
    ioProm.then(io => io.emit('change-color', {color: colorObj.color}))

    if (index < colorArray.length - 1) {
      nextColor = colorArray[index+1]
      setTimeout(() => setAndSchedule(colorArray, index + 1), colorObj.duration * 1000)
    }
  }

  setAndSchedule(seq, 0)
  res.send()
})

ioProm.then(io => {
  io.on('connection', (socket) => {
  })
})

server.listen(port, () => {
  console.log('listening on ' + port)
})
