// Function to generate a random alphanumeric character
function getRandomCharacter() {
  const characters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomIndex = Math.floor(Math.random() * characters.length);
  return characters[randomIndex];
}

// Function to generate a unique code
function generateUniqueCode() {
  let code = "";
  const codeLength = 6;

  while (code.length < codeLength) {
    const character = getRandomCharacter();

    // Check if the character is already present in the code
    if (code.indexOf(character) === -1) {
      code += character;
    }
  }

  return code;
}

module.exports = {
  generateUniqueCode,
};
