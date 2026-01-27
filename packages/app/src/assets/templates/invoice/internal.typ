#import "@preview/zero:0.6.0": format-table, num, zi
#import "@preview/datify:1.0.0": *

#let quantityUnits = (
  h: zi.hour(),
  kg: zi.kilogram(),
  m: zi.meter(),
)

// Internal functions
#let ternary(c, a, b) = if c { a } else { b }
#let currencySymbols = (
  EUR: sym.euro,
  USD: sym.dollar,
)

#let formatQuantity(quantity, quantityPerMille, unit) = {
  let text = ""
  if (quantityPerMille != none) {
    text += num(quantity / 1000)
  } else {
    text += num(quantity)
  }

  if (unit != none) {
    text += [ #quantityUnits.at(unit)]
  }
  return text
}

#let formatPrice(price, currency) = {
  if (price != 0) {
    text[#currencySymbols.at(currency) #num(price / 100, digits: 2)]
  } else {
    sym.dash.em
  }
}

#let formatDate(date, locale, pattern: "short") = {
  // https://github.com/typst/typst/issues/4107
  let dt = toml(bytes("date = " + date)).date
  let text = custom-date-format(dt, lang: locale, pattern: pattern)
  text
}
