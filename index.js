var express = require('express')
var ioProm = require('express-socket.io')
var cors = require('cors')

const app = express()
var port = process.env.PORT || 3000
var server = ioProm.init(app)

app.use(cors())
// {credentials: true, origin: 'http://localhost:8080'}
app.get('/', (req, res) => {
  res.send({status: 'success'})
})

app.put('/color/:color', (req, res) => {
  console.log(req.params)
  ioProm.then(io => io.emit('change-color', {color: req.params.color}))

  res.send()
})

ioProm.then(io => {
  io.on('connection', (socket) => {
    console.log('connected')
    socket.on('test', () => console.log('test received'))
  })
})

server.listen(port, () => {
  console.log('listening on ' + port)
})
