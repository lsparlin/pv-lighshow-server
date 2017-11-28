class ColorDuration {
  constructor(color, duration) {
    this.color = color
    this.duration = duration
  }

  static isColorDuration(obj) {
    let props = Object.keys(obj)
    if (props.length == 2) {
       return props.includes('color') && props.includes('duration')
    } else if (props.length == 3) {
       return props.includes('color') && props.includes('duration') && props.includes('message')
    }
  }
}

module.exports = ColorDuration
