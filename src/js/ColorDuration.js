class ColorDuration {
  constructor(color, duration) {
    this.color = color
    this.duration = duration
  }

  static isColorDuration(obj) {
    let props = Object.keys(obj)
    return (props.length == 2 && props.includes('color') && props.includes('duration'))
  }
}

module.exports = ColorDuration
