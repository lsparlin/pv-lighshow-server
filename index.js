var express = require('express')
var ioProm = require('express-socket.io')
var cors = require('cors')

const app = express()
var port = process.env.PORT || 3000
var server = ioProm.init(app)

app.use(cors())
app.use(function(req, res, next) {
  console.log('access interceptor', req.domain, req.ip)
  next();
  //res.status(403).end('forbidden');
});

// {credentials: true, origin: 'http://localhost:8080'}
app.get('/', (req, res) => {
  res.send({status: 'success', info: {ip: req.ip, domain: req.domain}})
})

app.put('/color/:color', (req, res) => {
  ioProm.then(io => io.emit('change-color', {color: req.params.color}))

  res.send()
})

ioProm.then(io => {
  io.on('connection', (socket) => {
  })
})

server.listen(port, () => {
  console.log('listening on ' + port)
})
