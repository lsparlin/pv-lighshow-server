const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const mongo = require('mongodb')
const Password = require('password-hash-and-salt')
const MongoClient = mongo.MongoClient

const ColorDuration = require('./src/js/ColorDuration.js')
const SequenceStore = require('./src/js/SequenceStore.js')

const app = express()
let allowedOrigins = ['localhost:8080', 'pv-lightshow-admin.netlify.com']
const checkOrigin = (origin, callback) => {
  if (!origin) {
    console.log('undefined origin found!')
  }
  return callback(null, true)
  //var match = allowedOrigins.find(allowed => origin && origin.includes(allowed))
  //if (match) callback(null, true)
  //else callback(new Error('Origin ' + origin + ' is not on whitelist'))
}
app.use(cors({
  origin: checkOrigin,
  credentials: true
}))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(cookieParser())
// initialize express-session
app.use(session({
  key: 'user_sid',
  secret: 'pvlightshowinteractive',
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: 86400000 // 24 hours
  }
}))
app.use((req, res, next) => { // log out if session is not consistent with cookie
  if (req.cookies.user_sid && !req.session.user) {
    res.clearCookie('user_sid');        
  }
  next();
});
var port = process.env.PORT || 3000
const server = app.listen(port, () => {
  console.log('listening on ' + port)
})

// define Socket.io connection
const io = require('socket.io')(server)
io.on('connection', (socket) => {
  console.log('a client connected')
  socket.on('lat-ping', () => socket.emit('lat-pong'))
  socket.on('disconnect', () => console.log('a client disconnected'))
})

// Start MongoClient
var db
var mongodb_url = process.env.MONGODB_URI ||  'mongodb://127.0.0.1:27017/pv_lightshow'
const SEQ_COLLECTION_NAME = 'color_sequence'
const SETTINGS_COLLECTION_NAME = 'site_settings'

MongoClient.connect(mongodb_url, (err, database) => {
  if (err) return console.log(err)
  db = database
})


// Routes

// middleware function to check for logged-in users
var forceAuth = (req, res, next) => {
  if (req.session.user && req.cookies.user_sid) {
    next();
  } else {
    res.status(401).send()
  }    
}

app.get('/', forceAuth, (req, res) => {
  res.send({status: 'success', info: {ip: req.ip, domain: req.domain}})
})

app.get('/settings', (req, res) => {
  db.collection(SETTINGS_COLLECTION_NAME).findOne({'_id': '1'}, (err, doc) => {
    res.send(doc)
  })
})

app.get('/user_info', forceAuth, (req, res) => {
  let user = req.session.user
  res.send({username: user.username, is_master: user.is_master})
})

app.post('/login', (req, res) => {
  var username = req.body.username,
      password = req.body.password

  authenticate(username, password).then(status => {
    req.session.user = status.user
    res.status(200).send()
  }).catch(status => {
    res.status(401).send()
  })
})

app.get('/logout', (req, res) => {
  res.clearCookie('user_sid');        
  req.session.user = undefined
  res.send('Logout success')
})

app.put('/settings/put_one', forceAuth, (req, res) => {
  let setting = req.body.setting
  const ALLOWED_SETTINGS = ['conclusionUrl', 'introductoryText', 'editingLocked']

  if (ALLOWED_SETTINGS.includes(setting.name)) {
    db.collection(SETTINGS_COLLECTION_NAME).update({"_id": '1'}, {$set: {[setting.name]: setting.value}}, (err, numberUpdated) => {
      res.send()
    })
  } else {
    res.status(400).send({"message": "unknown setting: " + setting.name})
  }
})

app.put('/color/:color', forceAuth, (req, res) => {
  io.emit('change-color', {color: req.params.color})

  res.send()
})

app.get('/sequence', forceAuth, (req, res) => {
  let query = {$or: [
    {deleted: {$exists: false}},
    {deleted: false}
  ]}
  db.collection(SEQ_COLLECTION_NAME).find(query, {sort: [['order_index',1],['name',1]]}).toArray((err, results) => {
    res.send(results)
  })
})

app.put('/sequence', forceAuth, (req, res) => {
  let sequence = req.body.sequence
  if (sequence.name && sequence.colorSequence && Array.isArray(sequence.colorSequence)) {
    let idToUpdate = mongo.ObjectID()
    let finalSequence = { name: sequence.name,
      colorSequence: sequence.colorSequence.filter(item => ColorDuration.isColorDuration(item)),
      order_index: sequence.order_index,
      deleted: false
    }
    if (finalSequence.order_index === undefined) {
      finalSequence.order_index = 999
    }
    if (finalSequence.colorSequence.length == 0) {
      return res.status(400).send({"message": "color sequence was empty"})
    }
    if (sequence._id) {
      idToUpdate = mongo.ObjectID(sequence._id)
    }

    db.collection(SEQ_COLLECTION_NAME).update({"_id": idToUpdate}, finalSequence, {upsert: true, w: 1}, (err, numberUpdated) => {
      res.send()
    })
  } else {
    res.status(400).send({"message": "object structure is incorrect"})
  }

})

app.put('/sequence/reorder', forceAuth, (req, res) => {
  let sequenceOrderArray = req.body.sequenceOrder
  if (Array.isArray(sequenceOrderArray) && sequenceOrderArray.length && sequenceOrderArray[0].id && sequenceOrderArray[0].order_index >= 0) {
   sequenceOrderArray.forEach( seq => {
     db.collection(SEQ_COLLECTION_NAME).update({"_id": mongo.ObjectID(seq.id)}, {$set: {"order_index": seq.order_index}})
   })
    res.send()
  } else {
    res.status(400).send({"message": "object structure is incorrect"})
  }
})

app.delete('/sequence/:sequenceId', forceAuth,  (req, res) => {
  db.collection(SEQ_COLLECTION_NAME).findAndModify({"_id": mongo.ObjectID(req.params.sequenceId)}, [], {$set: {deleted: true}}, {new: true}, (error, doc) => {
    if (doc.ok === 1) {
      res.send()
    } else {
      res.status(500).send()
    }
  })
})

app.put('/sequence/:sequenceId', forceAuth, (req, res) => {
  db.collection(SEQ_COLLECTION_NAME).findOne({"_id": mongo.ObjectID(req.params.sequenceId)}, (err, doc) => {
    var seq = doc
    if (seq) {
      const setAndSchedule = (colorArray, index) => {
        colorObj = colorArray[index]
        var colorData = { color: colorObj.color }
        if (index < colorArray.length - 1) {
          colorData.next = { color: colorArray[index + 1].color, afterDur: colorObj.duration * 1000 }
        }
        
        io.emit('change-color', colorData)
        if (index < colorArray.length - 1) {
          nextColor = colorArray[index+1]
          setTimeout(() => setAndSchedule(colorArray, index + 1), colorObj.duration * 1000)
        } 
      }

      setAndSchedule(seq.colorSequence, 0)
      res.send()
    } else {
      res.send({error: "No sequence found named " + req.params.name})
    }
  })

})

app.put('/conclude', forceAuth, (req, res) => {
  io.emit('conclude')

  res.send()
})

function authenticate(username, password) {
  var status = { verified: false, user: {} }
  return new Promise( (resolve, reject) => {
    if (username && password) {
      db.collection('users').findOne({'username': username}, (err, doc) => {
        if (err || !doc) return reject(status)
        var user = doc
        status.user = user
        Password(password).verifyAgainst(user.hash, (err, verified) => {
          if (err || !verified) return reject(status)
          else status.verified = verified
          resolve(status)
        })
      })
    } else {
      return reject(status)
    }
  })
}


