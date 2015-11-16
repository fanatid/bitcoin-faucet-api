/**
 * @param {*} val
 * @param {Function[]} predicates
 * @param {string} name
 */
export function isValid (val, predicates, name) {
  if (!Array.isArray(predicates)) {
    predicates = [predicates]
  }

  for (let predicate of predicates) {
    if (!predicate(val)) {
      throw new Error(`${name} is invalid: ${val}`)
    }
  }
}
