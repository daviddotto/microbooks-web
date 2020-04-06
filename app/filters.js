module.exports = () => {
  /**
   * Instantiate the object used to store the methods registered as a
   * 'filter' (of the same name) within nunjucks. You can override
   * gov.uk core filters by creating filter methods of the same name.
   * @type {Object}
   */
  let filters = {}

  const separateThousandsWithComma = input => {
    let amount = Math.round(Number(input) * 100) / 100
    if (amount % 1 !== 0) {
      amount = amount.toFixed(2)
    }
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const toFriendlyNumber = input => {
    if (input === 0 || input === '0' || !input) {
      return 'None'
    } else {
      return separateThousandsWithComma(input)
    }
  }

  filters.currency = (number, prefix) => {
    if (!prefix) {
      prefix = '£'
    }
    return prefix + separateThousandsWithComma(number)
  }

  filters.friendlyNumber = input => {
    return toFriendlyNumber(input)
  }

  filters.redirect = location => {
    return `<script>window.location.href = '${location}';</script>`
  }

  filters.currentYear = () => {
    return new Date().getFullYear()
  }

  filters.debug = str => {
    return JSON.stringify(str)
  }

  const numberToMonthString = input => {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ]
    return months[Number(input)]
  }

  filters.friendlyDate = (str, nowStr) => {
    if (!str) {
      return '-'
    }
    const date = new Date(str)
    const now = new Date(nowStr)
    const secondsPassed = (now - date) / 1000
    if (secondsPassed < 15) {
      return 'just now'
    } else if (secondsPassed < 60) {
      return 'less than a minute ago'
    } else if (secondsPassed < 75) {
      return 'a minute ago'
    } else if (secondsPassed < 60 * 4) {
      return 'a few minutes ago'
    } else if (secondsPassed < 60 * 59) {
      return Math.floor(secondsPassed / 60) + ' minutes ago'
    } else if (now.getDate() === date.getDate()) {
      return (
        'today at ' +
        ('0' + Math.round(date.getHours())).slice(-2) +
        ':' +
        ('0' + date.getMinutes()).slice(-2)
      )
    } else {
      return (
        date.getDate() +
        ' ' +
        numberToMonthString(date.getMonth()) +
        ' ' +
        date.getFullYear() +
        ' at ' +
        ('0' + Math.round(date.getHours())).slice(-2) +
        ':' +
        ('0' + date.getMinutes()).slice(-2)
      )
    }
  }

  filters.month = number => numberToMonthString(number - 1)

  filters.lowerCase = str => str.toLowerCase()

  filters.upperCase = str => str.toUpperCase()

  filters.titleCase = str => {
    return str.replace(/\w\S*/g, txt => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    })
  }

  filters.sentenceCase = str => {
    return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase()
  }

  filters.numbersOnly = str =>
    str
      .toString()
      .match(/\d+/g)
      .join('')

  filters.urlSafe = str => encodeURIComponent(str)

  filters.contains = (test, str) => {
    if (test) {
      return test.includes(str)
    } else {
      return false
    }
  }

  filters.pluralLabel = (amount, singleSuffix, pluralSuffix, zeroLabel) => {
    if (amount === 1) {
      return `${amount} ${singleSuffix}`
    } else if (zeroLabel && amount === 0) {
      return `${zeroLabel}`
    } else {
      return `${amount} ${pluralSuffix}`
    }
  }

  filters.errorFor = (errorArray, inputKey) => {
    if (errorArray && Array.isArray(errorArray)) {
      const outputArray = errorArray.filter(error => {
        var normalisedErrorParam = error.param
          .replace('[', '')
          .replace(']', '')
          .replace('.', '')
        var normalisedInputKey = inputKey
          .replace('[', '')
          .replace(']', '')
          .replace('.', '')
        return normalisedErrorParam === normalisedInputKey
      })
      return outputArray.length ? outputArray : false
    }
    return false
  }

  return filters
}
