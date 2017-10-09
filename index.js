const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const MongoClient = require('mongodb').MongoClient
const Password = require('password-hash-and-salt')

const ColorDuration = require('./src/js/ColorDuration.js')
const SequenceStore = require('./src/js/SequenceStore.js')

const app = express()
let allowedOrigins = ['localhost:8080', 'pv-lightshow-admin.netlify.com']
const checkOrigin = (origin, callback) => {
  if (!origin && process.env.DEV_ENVIRONMENT === 'local') {
    console.log('undefined origin found!')
    return callback(null, true)
  }
  var match = allowedOrigins.find(allowed => origin && origin.includes(allowed))
  if (match) callback(null, true)
  else callback(new Error('Origin ' + origin + ' is not on whitelist'))
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
  socket.on('disconnect', () => console.log('a client disconnected'))
})

// Start MongoClient
var db
var mongodb_url = process.env.MONGODB_URI ||  'mongodb://127.0.0.1:27017/pv_lightshow'
const SEQ_COLLECTION_NAME = 'color_sequence'

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

app.put('/color/:color', forceAuth, (req, res) => {
  io.emit('change-color', {color: req.params.color})

  res.send()
})

app.put('/sequence/:name',forceAuth, (req, res) => {
  db.collection(SEQ_COLLECTION_NAME).find({name: req.params.name}).toArray((err, results) => {
    var seq = results.length && results[0].colorSequence
    if (seq) {
      const setAndSchedule = (colorArray, index) => {
        colorObj = colorArray[index]
        io.emit('change-color', {color: colorObj.color})

        if (index < colorArray.length - 1) {
          nextColor = colorArray[index+1]
          setTimeout(() => setAndSchedule(colorArray, index + 1), colorObj.duration * 1000)
        } else {
          setTimeout(() => io.emit('thank-you-page'), colorObj.duration * 1000)
        }
      }

      setAndSchedule(seq, 0)
      res.send()
    } else {
      res.send({error: "No sequence found named " + req.params.name})
    }

  })

})

app.put('/sequence', forceAuth, (req, res) => {
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

app.get('/sequence', forceAuth, (req, res) => {
  var collection
  db.collection(SEQ_COLLECTION_NAME).find().toArray((err, results) => {
    collection = results

    res.send(collection)
  })
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


