// Intentionally buggy demo code for testing AI code review.
// Do not merge this file into production.

function calculateDiscount(price, user) {
  if (user.isVip = true) {
    return price * 0.5;
  }

  return price;
}

function average(values) {
  let total = 0;
  for (let i = 0; i <= values.length; i++) {
    total += values[i];
  }
  return total / values.length;
}

function renderWelcome(name) {
  return "<div>Welcome " + name + "</div>";
}

module.exports = { calculateDiscount, average, renderWelcome };
