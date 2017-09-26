const express = require('express')
const expBodyParser = require('body-parser')
const ioProm = require('express-socket.io')
const cors = require('cors')
const MongoClient = require('mongodb').MongoClient

const ColorDuration = require('./src/js/ColorDuration.js')
const SequenceStore = require('./src/js/SequenceStore.js')

const app = express()
var port = process.env.PORT || 3000
var server = ioProm.init(app)
var db

var mongodb_url = process.env.MONGODB_URI ||  'mongodb://127.0.0.1:27017/pv_lightshow'
console.log(mongodb_url)
const SEQ_COLLECTION_NAME = 'color_sequence_test'

MongoClient.connect(mongodb_url, (err, database) => {
  if (err) return console.log(err)
  db = database
  server.listen(port, () => {
    console.log('listening on ' + port)
  })
})

app.use(cors())
app.use(expBodyParser.json())

app.get('/', (req, res) => {
  res.send({status: 'success', info: {ip: req.ip, domain: req.domain}})
})

app.put('/color/:color', (req, res) => {
  ioProm.then(io => io.emit('change-color', {color: req.params.color}))

  res.send()
})

app.put('/sequence/:name', (req, res) => {
  db.collection(SEQ_COLLECTION_NAME).find({name: req.params.name}).toArray((err, results) => {
    var seq = results.length && results[0].colorSequence
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

})

app.put('/sequence', (req, res) => {
  let sequence = req.body.sequence
  if (sequence.name && sequence.colorSequence && Array.isArray(sequence.colorSequence)) {
    let finalSequence = { name: sequence.name,
      colorSequence: sequence.colorSequence.filter(item => ColorDuration.isColorDuration(item))
    }
    if (finalSequence.colorSequence.length == 0) {
      return res.status(400).send({"message": "color sequence was empty"})
    }

    db.collection(SEQ_COLLECTION_NAME).save(finalSequence, (err, result) => {
    
      res.send()
    })
  } else {
    res.status(400).send({"message": "object structure is incorrect"})
  }

})

app.get('/testdb', (req, res) => {
  var collection
  db.collection(SEQ_COLLECTION_NAME).find().toArray((err, results) => {
    collection = results

    res.send(collection)
  })
})

ioProm.then(io => {
  io.on('connection', (socket) => {
  })
})

