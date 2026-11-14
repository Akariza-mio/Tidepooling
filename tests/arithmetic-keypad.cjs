// Exercise the player's on-screen input path; the answer field is read-only.
module.exports = async function enterArithmeticAnswer(surface, value) {
  await surface.locator('.arithmetic-key[data-value="clear"]').click();
  for (const digit of String(value)) {
    if (!/^\d$/.test(digit)) throw new Error('The game keypad accepts decimal digits only.');
    await surface.locator(`.arithmetic-key[data-value="${digit}"]`).click();
  }
};
