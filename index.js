var express = require('express')
var ioProm = require('express-socket.io')
var cors = require('cors')

var SequenceStore = require('./src/js/SequenceStore.js')

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
  let seq = SequenceStore.namedSequence[req.params.name]
  if (seq) {
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
  } else {
    res.send({error: "No sequence found named " + req.params.name})
  }
})

ioProm.then(io => {
  io.on('connection', (socket) => {
  })
})

server.listen(port, () => {
  console.log('listening on ' + port)
})
