var ColorDuration = require('./ColorDuration.js')

module.exports = {
  "namedSequence": {
    "test1": [
      new ColorDuration('ff0000', 3),
      new ColorDuration('ff7878', 3),
      new ColorDuration('ffffff', 2),
      new ColorDuration('660099', 5),
      new ColorDuration('333333', 3)
    ],
    "test2": [
      new ColorDuration('333333', 3),
      new ColorDuration('660099', 5),
      new ColorDuration('ffffff', 2),
      new ColorDuration('ff7878', 3),
      new ColorDuration('ff0000', 3)
    ]
  }
}
