const CODES = {
  "00": { meaning: "Thin Client UTS", length: 5, data: "thUts" },
  "01": {
    meaning: "Source Station",
    length: `4 + 16 + 16`,
    data: "station code : station name eng : station name hindi",
    access: "source_station",
  },
  "02": {
    meaning: "Destination Station",
    length: `4 + 16 + 16`,
    data: "station code : station name eng : station name hindi",
    access: "destination_station",
  },
  "03": {
    meaning: "Date",
    length: `2`,
    data: "values 01-12",
  },
  "04": {
    meaning: "Month",
    length: `2`,
    data: "values 01-12",
  },
  "05": {
    meaning: "Adult",
    length: `2`,
    data: "values 01-12",
  },
  "06": {
    meaning: "Child",
    length: `2`,
    data: "values 01-12",
  },
  "07": {
    meaning: "Type Of Train",
    length: `01`,
    data: "E / S / O / T",
  },
  "08": {
    meaning: "Fare",
    length: `01-05`,
    data: "1/11/111/1111/11111",
  },
  "09": {
    meaning: "Class",
    length: `02`,
    data: "I/II",
  },
  12: {
    meaning: "Transaction type",
    length: `04`,
    data: "PLAT",
  },
  13: {
    meaning: "To clear Display device",
    length: `0`,
    data: " ",
  },
  14: {
    meaning: "Cancellation Refund amount",
    code: {
      length: "04",
      data: "CANC",
    },
    Type: {
      length: "04",
      data: "RFND",
    },
    Amount: {
      length: "01-05",
      data: "111",
    },
  },
  15: {
    meaning: "Operator Name, Terminal, window No, Shift No",
    Operator: {
      length: "25",
      data: "MUKESH KUMAR GARHWAL",
    },
    Terminal: {
      length: "06",
      data: "NDLS99",
    },
    WindowNo: {
      length: "03",
      data: "105",
    },
    ShiftNo: {
      length: "01",
      data: "3",
    },
  },
  17: {
    meaning: "Source Station2",
    Code: {
      length: "04",
      data: "station code",
    },
    Eng: {
      length: "16",
      data: "station name (Eng)",
    },
    Hindi: {
      length: "16",
      data: "station name (Hindi)",
    },
  },
  18: {
    meaning: "Source Station3",
    Code: {
      length: "04",
      data: "station code",
    },
    Eng: {
      length: "16",
      data: "station name (Eng)",
    },
    Hindi: {
      length: "16",
      data: "station name (Hindi)",
    },
  },
  19: {
    meaning: "Destination Station2",
    Code: {
      length: "04",
      data: "station code",
    },
    Eng: {
      length: "16",
      data: "station name (Eng)",
    },
    Hindi: {
      length: "16",
      data: "station name (Hindi)",
    },
  },
  20: {
    meaning: "Destination Station2",
    Code: {
      length: "04",
      data: "station code",
    },
    Eng: {
      length: "16",
      data: "station name (Eng)",
    },
    Hindi: {
      length: "16",
      data: "station name (Hindi)",
    },
  },
  21: {
    meaning: "To display Payment Gateway",
    length: `length varies`,
    data: " ",
  },
  22: {
    meaning: "To display QRCode for payment",
    length: `length varies`,
    data: " ",
    access: "qr_code",
  },
};

const trainTypes = {
  O: {
    value: "ORD",
    description: "ORDINARY",
  },
  E: {
    value: "M/E",
    description: "MAIL/EXP",
  },
  S: {
    value: "SUP",
    description: "SUPERFAST",
  },
  T: {
    value: "MMT",
    description: "MMTS",
  },
  C: {
    value: "COM",
    description: "COMBINED",
  },
  R: {
    value: "RAJ",
    description: "RAJDHANI",
  },
  D: {
    value: "SHT",
    description: "SHATABDI",
  },
  M: {
    value: "RMT",
    description: "RAIL MOTOR",
  },
  H: {
    value: "DHI",
    description: "DARJILLING HILL",
  },
  J: {
    value: "JAN",
    description: "JAN SHATABDI",
  },
  P: {
    value: "PRM",
    description: "PREMIUM SPL",
  },
};

const transcationCode = {
  SPLC: "SPECIAL CANCEL",
  PLAT: "PLATFORM",
  NI: "NON-ISSUE",
  CANC: "CANCELLATION",
  ST: "SEASON TICKET",
  BPT: "BPT TICKET",
  SF: "SUPERFAST TICKET",
  JRNY: "JOURNEY",
  CARD: "I CARD",
  MMQT: "MULTIRT MST-QST",
  RRTT: "RAIL/TOURIST",
  PART: "PARTIAL CANCELLATION",
};

export function processData(data) {
  //   const data = "$0126NDLS:NEW DELHI:NEW DELHI:^$0226HYD:HYDERABAD:HYDERABAD:^";

  //   const x = data.split("$").map((e) => e.split("^")[0]);
  //   console.log("data_131: ", data);
  const x = data.split("$");
  const y = x.reduce((acc, cur) => {
    const code = cur.slice(0, 2);
    if (code && !acc[code]) acc[CODES[code].access] = createJson(cur, code);
    return acc;
  }, {});
  console.log("processed Data: ", y);
  //   io.emit("serialData", y);
  // console.log(Processed Data: '${data.trim()}');
  return y;
}

function createJson(data, code) {
  let JSON = {};

  if (code.toString() === "01") {
    const length = data.slice(2, 4);
    const names = data.slice(4);
    const [station_code, eng_name, hin_name] = names.split(":");
    JSON = { names, length, station_code, eng_name, hin_name };
  }
  if (code.toString() === "02") {
    const length = data.slice(2, 4);
    const names = data.slice(4);
    const [station_code, eng_name, hin_name] = names.split(":");
    JSON = { names, length, station_code, eng_name, hin_name };
  }
  return JSON;
}

// function createJson(data, code) {
//   console.log(data, code);
//   let JSON = {};

//   if (code.toString() === "00") {
//     let lengthStr = "";
//     let start = 3;
//     let i = start;

//     // Step 1: Keep adding digits to lengthStr and validate
//     while (i < data.length && /\d/.test(data[i])) {
//       lengthStr += data[i];
//       const length = parseInt(lengthStr, 10);

//       // Try to extract fullData based on this length
//       const fullData = data.slice(i + 1, i + 1 + length);

//       // Check if length matches
//       if (fullData.length === length) {
//         // Optional: Check if next characters are ':^' (not mandatory)
//         const remaining = data.slice(i + 1 + length);
//         if (remaining.startsWith(":^") || remaining.length === 0) {
//           // ✅ Correct length found
//           const [data] = fullData.split(":");
//           JSON = { data };
//           console.log(JSON);
//           break;
//         }
//       }
//       i++;
//     }
//   }

//   if (code.toString() === "01") {
//     const length = data.slice(2, 4);
//     const names = data.slice(4);
//     const [station_code, eng_name, hin_name] = names.split(":");
//     JSON = { names, length, station_code, eng_name, hin_name };
//   }

//   if (code.toString() === "02") {
//     const length = data.slice(2, 4);
//     const names = data.slice(4);
//     const [station_code, eng_name, hin_name] = names.split(":");
//     JSON = { names, length, station_code, eng_name, hin_name };
//   }

//   if (code.toString() === "03") {
//     const dateData = data.slice(5, 7);
//     JSON = { dateData };
//     console.log(JSON);
//   }

//   if (code.toString() === "04") {
//     const monthData = data.slice(5, 7);
//     JSON = { monthData };
//     console.log(JSON);
//   }

//   if (code.toString() === "05") {
//     const adultData = data.slice(5, 7);
//     JSON = { adultData };
//     console.log(JSON);
//   }

//   if (code.toString() === "06") {
//     const childData = data.slice(5, 7);
//     JSON = { childData };
//     console.log(JSON);
//   }

//   if (code.toString() === "07") {
//     const typeOfTrainData = data.slice(5, 6);
//     JSON = trainTypes[typeOfTrainData];
//     console.log(JSON);
//   }

//   if (code.toString() === "08") {
//     let lengthStr = "";
//     let start = 3;
//     let i = start;

//     // Step 1: Keep adding digits to lengthStr and validate
//     while (i < data.length && /\d/.test(data[i])) {
//       lengthStr += data[i];
//       const length = parseInt(lengthStr, 10);

//       // Try to extract fullData based on this length
//       const fullData = data.slice(i + 1, i + 1 + length);

//       // Check if length matches
//       if (fullData.length === length) {
//         // Optional: Check if next characters are ':^' (not mandatory)
//         const remaining = data.slice(i + 1 + length);
//         if (remaining.startsWith(":^") || remaining.length === 0) {
//           // ✅ Correct length found
//           const [fareData] = fullData.split(":");
//           JSON = { fareData };
//           console.log(JSON);
//           break;
//         }
//       }
//       i++;
//     }
//   }

//   if (code === "09") {
//     const Class = data.slice(5, 7);
//     JSON = { Class };
//     console.log(JSON);
//   }

//   //   if (code === 11) {
//   //     const thinClientUts = data.slice(5, 10);
//   //     JSON = { thinClientUts };
//   //   }

//   if (code === "12") {
//     let lengthStr = "";
//     let start = 3;
//     let i = start;

//     // Step 1: Keep adding digits to lengthStr and validate
//     while (i < data.length && /\d/.test(data[i])) {
//       lengthStr += data[i];
//       const length = parseInt(lengthStr, 10);

//       // Try to extract fullData based on this length
//       const fullData = data.slice(i + 1, i + 1 + length);

//       // Check if length matches
//       if (fullData.length === length) {
//         // Optional: Check if next characters are ':^' (not mandatory)
//         const remaining = data.slice(i + 1 + length);
//         if (remaining.startsWith(":^") || remaining.length === 0) {
//           // ✅ Correct length found
//           const [transactionTypeData] = fullData.split(":");
//           const transactionType = transcationCode[transactionTypeData];
//           JSON = { transactionType };
//           //   console.log(transactionType);
//           console.log(JSON);
//           break;
//         }
//       }
//       i++;
//     }
//   }

//   if (code === "13") {
//     const clearDisplay = data.slice(5, 6);
//     JSON = { clearDisplay };
//     console.log(JSON);
//   }

//   if (code.toString() === "14") {
//     let lengthStr = "";
//     let start = 3;
//     let i = start;

//     // Step 1: Keep adding digits to lengthStr and validate
//     while (i < data.length && /\d/.test(data[i])) {
//       lengthStr += data[i];
//       const length = parseInt(lengthStr, 10);

//       // Try to extract fullData based on this length
//       const fullData = data.slice(i + 1, i + 1 + length);

//       // Check if length matches
//       if (fullData.length === length) {
//         // Optional: Check if next characters are ':^' (not mandatory)
//         const remaining = data.slice(i + 1 + length);
//         if (remaining.startsWith(":^") || remaining.length === 0) {
//           // ✅ Correct length found
//           const [codeData, type, amount] = fullData.split(":");
//           const code = transcationCode[codeData];
//           JSON = { length, code, type, amount };
//           console.log(JSON);
//           break;
//         }
//       }
//       i++;
//     }
//   }

//   if (code.toString() === "15") {
//     let lengthStr = "";
//     let start = 3;
//     let i = start;

//     // Step 1: Keep adding digits to lengthStr and validate
//     while (i < data.length && /\d/.test(data[i])) {
//       lengthStr += data[i];
//       const length = parseInt(lengthStr, 10);

//       // Try to extract fullData based on this length
//       const fullData = data.slice(i + 1, i + 1 + length);

//       // Check if length matches
//       if (fullData.length === length) {
//         // Optional: Check if next characters are ':^' (not mandatory)
//         const remaining = data.slice(i + 1 + length);
//         if (remaining.startsWith(":^") || remaining.length === 0) {
//           // ✅ Correct length found
//           const [Operator, Terminal, WindowNo, ShiftNo] = fullData.split(":");
//           JSON = { Operator, Terminal, WindowNo, ShiftNo };
//           console.log(JSON);
//           break;
//         }
//       }
//       i++;
//     }
//   }

//   if (code.toString() === "17") {
//     let lengthStr = "";
//     let start = 3;
//     let i = start;

//     // Step 1: Keep adding digits to lengthStr and validate
//     while (i < data.length && /\d/.test(data[i])) {
//       lengthStr += data[i];
//       const length = parseInt(lengthStr, 10);

//       // Try to extract fullData based on this length
//       const fullData = data.slice(i + 1, i + 1 + length);

//       // Check if length matches
//       if (fullData.length === length) {
//         // Optional: Check if next characters are ':^' (not mandatory)
//         const remaining = data.slice(i + 1 + length);
//         if (remaining.startsWith(":^") || remaining.length === 0) {
//           // ✅ Correct length found
//           const [
//             sourceStation2Code,
//             sourceStation2NameEnglish,
//             sourceStation2NameHindi,
//           ] = fullData.split(":");
//           JSON = {
//             sourceStation2Code,
//             sourceStation2NameEnglish,
//             sourceStation2NameHindi,
//           };
//           console.log(JSON);
//           break;
//         }
//       }
//       i++;
//     }
//   }
//   if (code.toString() === "18") {
//     let lengthStr = "";
//     let start = 3;
//     let i = start;

//     // Step 1: Keep adding digits to lengthStr and validate
//     while (i < data.length && /\d/.test(data[i])) {
//       lengthStr += data[i];
//       const length = parseInt(lengthStr, 10);

//       // Try to extract fullData based on this length
//       const fullData = data.slice(i + 1, i + 1 + length);

//       // Check if length matches
//       if (fullData.length === length) {
//         // Optional: Check if next characters are ':^' (not mandatory)
//         const remaining = data.slice(i + 1 + length);
//         if (remaining.startsWith(":^") || remaining.length === 0) {
//           // ✅ Correct length found
//           const [
//             sourceStation3Code,
//             sourceStation3NameEnglish,
//             sourceStation3NameHindi,
//           ] = fullData.split(":");
//           JSON = {
//             sourceStation3Code,
//             sourceStation3NameEnglish,
//             sourceStation3NameHindi,
//           };
//           console.log(JSON);
//           break;
//         }
//       }
//       i++;
//     }
//   }
//   if (code.toString() === "19") {
//     let lengthStr = "";
//     let start = 3;
//     let i = start;

//     // Step 1: Keep adding digits to lengthStr and validate
//     while (i < data.length && /\d/.test(data[i])) {
//       lengthStr += data[i];
//       const length = parseInt(lengthStr, 10);

//       // Try to extract fullData based on this length
//       const fullData = data.slice(i + 1, i + 1 + length);

//       // Check if length matches
//       if (fullData.length === length) {
//         // Optional: Check if next characters are ':^' (not mandatory)
//         const remaining = data.slice(i + 1 + length);
//         if (remaining.startsWith(":^") || remaining.length === 0) {
//           // ✅ Correct length found
//           const [
//             destinationStation2Code,
//             destinationStation2NameEnglish,
//             destinationStation2NameHindi,
//           ] = fullData.split(":");
//           JSON = {
//             destinationStation2Code,
//             destinationStation2NameEnglish,
//             destinationStation2NameHindi,
//           };
//           console.log(JSON);
//           break;
//         }
//       }
//       i++;
//     }
//   }
//   if (code.toString() === "20") {
//     let lengthStr = "";
//     let start = 3;
//     let i = start;

//     // Step 1: Keep adding digits to lengthStr and validate
//     while (i < data.length && /\d/.test(data[i])) {
//       lengthStr += data[i];
//       const length = parseInt(lengthStr, 10);

//       // Try to extract fullData based on this length
//       const fullData = data.slice(i + 1, i + 1 + length);

//       // Check if length matches
//       if (fullData.length === length) {
//         // Optional: Check if next characters are ':^' (not mandatory)
//         const remaining = data.slice(i + 1 + length);
//         if (remaining.startsWith(":^") || remaining.length === 0) {
//           // ✅ Correct length found
//           const [
//             destinationStation3Code,
//             destinationStation3NameEnglish,
//             destinationStation3NameHindi,
//           ] = fullData.split(":");
//           JSON = {
//             destinationStation3Code,
//             destinationStation3NameEnglish,
//             destinationStation3NameHindi,
//           };
//           console.log(JSON);
//           break;
//         }
//       }
//       i++;
//     }
//   }
//   if (code.toString() === "21") {
//     let lengthStr = "";
//     let start = 3;
//     let i = start;

//     // Step 1: Keep adding digits to lengthStr and validate
//     while (i < data.length && /\d/.test(data[i])) {
//       lengthStr += data[i];
//       const length = parseInt(lengthStr, 10);

//       // Try to extract fullData based on this length
//       const fullData = data.slice(i + 1, i + 1 + length);

//       // Check if length matches
//       if (fullData.length === length) {
//         // Optional: Check if next characters are ':^' (not mandatory)
//         const remaining = data.slice(i + 1 + length);
//         if (remaining.startsWith(":^") || remaining.length === 0) {
//           // ✅ Correct length found
//           const [paymentGateway] = fullData.split(":");
//           JSON = { paymentGateway };
//           console.log(JSON);
//           break;
//         }
//       }
//       i++;
//     }
//   }
//   //   if (code.toString() === "22") {
//   //     let lengthStr = "";
//   //     let start = 3;
//   //     let i = start;

//   //     // Step 1: Keep adding digits to lengthStr and validate
//   //     while (i < data.length && /\d/.test(data[i])) {
//   //       lengthStr += data[i];
//   //       const length = parseInt(lengthStr, 10);

//   //       console.log(length);

//   //       // Try to extract fullData based on this length
//   //       const fullData = data.slice(i + 1, i + 1 + length);

//   //       console.log("fullData: ", fullData);
//   //       console.log("fullData length: ", fullData.length);
//   //       console.log("fullData: ", fullData);

//   //       // Check if length matches
//   //       if (fullData.length === length) {
//   //         console.log("Matched");

//   //         // Optional: Check if next characters are ':^' (not mandatory)
//   //         const remaining = data.slice(i + 1 + length);
//   //         if (remaining.startsWith(":^") || remaining.length === 0) {
//   //           // ✅ Correct length found
//   //           const [QRCode] = fullData.split(":");
//   //           JSON = { QRCode };
//   //           console.log(JSON);
//   //           break;
//   //         }
//   //       }
//   //       i++;
//   //     }
//   //   }

//   if (code.toString() === "22") {
//     let lengthStr = "";
//     let start = 3;
//     let i = start;

//     // Extract length (Stop when encountering a non-digit)
//     while (i < data.length && /\d/.test(data[i])) {
//       lengthStr += data[i];
//       i++;
//     }

//     // Convert extracted length to an integer
//     const length = parseInt(lengthStr, 10);
//     console.log("Extracted length:", length);

//     // Extract QR Code based on the length
//     const fullData = data.slice(i, i + length);
//     console.log("fullData:", fullData);
//     console.log("fullData length:", fullData.length);

//     // Validate length
//     if (fullData.length === length) {
//       console.log("Matched!");

//       const remaining = data.slice(i + length);
//       if (remaining.startsWith(":^") || remaining.length === 0) {
//         // ✅ Correct length found
//         const [QRCode] = fullData.split(":");
//         JSON = { QRCode };
//         console.log(JSON);
//       }
//     }
//   }
// }

/*
createJson("$0007thuts:^", "00");
createJson("$030431:^", "03");
createJson("$040412:^", "04");
createJson("$050460:^", "05");
createJson("$060404:^", "06");
createJson("$0703E:^", "07");
createJson("$0703S:^", "07");
createJson("$0703O:^", "07");
createJson("$0703T:^", "07");

createJson("$08035:^", "08");
createJson("$080414:^", "08");
createJson("$0805544:^", "08");
createJson("$08061004:^", "08");
createJson("$080745604:^", "08");

createJson("$0904 I:^", "09");
createJson("$0904II:^", "09");

createJson("$1204NI:^", "12");
createJson("$1205BPT:^", "12");
createJson("$1206PLAT:^", "12");

createJson("$1303 :^", "13");

createJson("$1415CANC:RFND:790:^", "14");

createJson("$1525VENU GOPAL:NLDS99:105:3:^", "15");
createJson("$1531GANESH KUMAR:ABCDEF9999:350:9:^", "15");

createJson("$1726NDLS:NEW DELHI:NEW DELHI:^", "17");
createJson("$1825HYD:HYDERABAD:HYDERABAD:^", "18");
createJson("$1926NDLS:NEW DELHI:NEW DELHI:^", "19");
createJson("$2034VSKP:VISAKHAPATNAM:VISAKHAPATNAM:^", "20");

createJson("$2124www.sandbox.paypal.com:^", "21");

createJson(
  "$22414X8vGpZJ3LKqNmWTB4Y5rVf92DCHoQzaEsU6Mb1tPdjkhOlgXxIw7n0RYAcFeKZMuJVT3pGmB9q5LdNHCFXyO2aWKvs68rPDzAMJQ41tbYxRkVfT7ZCwGoNL3H2m9pYqK5XJMdFVBzCWT18Rt6YAowLNqO4GH7PDv2XKpM3JZ9fyN5LFQTCBWXVG68Rt1MAodHYqK2pG7JZMP4XNvGpZJ3LKqNmWTB4Y5rVf92DCHoQzaEsU6Mb1tPdjkhOlgXxIw7n0RYAcFeKZMuJVT3pGmB9q5LdNHCFXyO2aWKvs68rPDzAMJQ41tbYxRkVfT7ZCwGoNL3H2m9pYqK5XJMdFVBzCWT18Rt6YAowLNqO4GH7PDv2XKpM3JZ9fyN5LFQTCBWXVG68Rt1MAodHYqK2pG7JZMP4XN:^",
  "22"
);

// module.exports = { CODES };
 */