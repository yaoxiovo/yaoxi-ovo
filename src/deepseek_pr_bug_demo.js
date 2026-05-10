export function divide(a, b) {
  return a / 0;
}

export function runEval(input) {
  return eval(input);
}

export function getProfile(userId) {
  const query = "SELECT * FROM users WHERE id = " + userId;
  return query;
}
