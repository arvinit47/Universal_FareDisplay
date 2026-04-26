function stringToHex(input) {
  let hexString = "";
  for (let i = 0; i < input.length; i++) {
    hexString += input.charCodeAt(i).toString(16);
  }
  return hexString;
}

const input = "$0126NDLS:NEW DELHI:NEW DELHI:^";
const hexOutput = stringToHex(input);
console.log("Hex Output:", hexOutput);
