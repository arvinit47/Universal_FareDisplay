const CODES = {
  "00": {
    meaning: "Thin Client UTS",
    length: 5,
    data: "thUts",
    access: "thin_client_uts",
  },
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
    access: "date",
  },
  "04": {
    meaning: "Month",
    length: `2`,
    data: "values 01-12",
    access: "month",
  },
  "05": {
    meaning: "Adult",
    length: `2`,
    data: "values 01-12",
    access: "adult",
  },
  "06": {
    meaning: "Child",
    length: `2`,
    data: "values 01-12",
    access: "child",
  },
  "07": {
    meaning: "Type Of Train",
    length: `01`,
    data: "E / S / O / T",
    access: "type_of_trian",
  },
  "08": {
    meaning: "Fare",
    length: `01-05`,
    data: "1/11/111/1111/11111",
    access: "fare",
  },
  "09": {
    meaning: "Class",
    length: `02`,
    data: "I/II",
    access: "class",
  },
  12: {
    meaning: "Transaction type",
    length: `04`,
    data: "PLAT",
    access: "transaction_type",
  },
  13: {
    meaning: "To clear Display device",
    length: `0`,
    data: " ",
    access: "clear_display_device",
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
    access: "cancellation_refund_amount",
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
    access: "operator_details",
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
    access: "source_station_2",
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
    access: "source_station_3",
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
    access: "destination_station_2",
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
    access: "destination_station_3",
  },
  21: {
    meaning: "To display Payment Gateway",
    length: `length varies`,
    data: " ",
    access: "payment_gateway",
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

// export function processData(raw) { ... }
export function processData(raw) {
  const parsed = {};
  const errors = [];

  try {
    if (!raw || typeof raw !== "string") {
      errors.push("input-not-string-or-empty");
      return { parsed, errors };
    }

    // normalize CR/LF
    const normalized = raw.replace(/\r/g, "").replace(/\n/g, "");
    // Extract complete frames that start with $ and end with ^ (non-greedy)
    const frameRegex = /\$[^$^]*?\^/g;
    const frames = normalized.match(frameRegex) || [];

    if (frames.length === 0) {
      // No complete frames yet
      return { parsed, errors: ["no-complete-frames-found"] };
    }

    frames.forEach((frame) => {
      try {
        // Defensive: collapse multiple leading $ if any
        const f = frame.replace(/^\${2,}/, "$"); // turn $$... into $
        // remove leading $ and trailing ^
        const core = f.slice(1, -1); // e.g. "060401:" or "1107thUts:"
        if (!core || core.length < 2) {
          errors.push({ frame, reason: "frame-too-short" });
          return;
        }

        const code = core.slice(0, 2);
        if (!code) {
          errors.push({ frame, reason: "missing-code" });
          return;
        }

        const spec = CODES[code];
        if (!spec) {
          errors.push({ frame, code, reason: "unknown-code" });
          return;
        }

        const accessKey = spec.access;
        if (!accessKey) {
          errors.push({ frame, code, reason: "missing-access-key" });
          return;
        }

        // If already parsed an item for this accessKey, skip (mirrors original logic)
        if (parsed[accessKey] !== undefined) {
          errors.push({ frame, code, reason: "duplicate-access-skip" });
          return;
        }

        // Optionally validate length field if your protocol uses it
        // Example: if spec.length is a number, check payload length minimally
        // But call createJson inside try/catch as it may be brittle
        try {
          const obj = createJson(f, code);
          if (obj && typeof obj === "object") parsed[accessKey] = obj;
          else {
            errors.push({ frame, code, reason: "createJson-return-invalid" });
          }
        } catch (cjErr) {
          errors.push({ frame, code, reason: "createJson-error", error: String(cjErr) });
        }
      } catch (frameErr) {
        errors.push({ frame, reason: "frame-processing-exception", error: String(frameErr) });
      }
    });

    return { parsed, errors: errors.length ? errors : null };
  } catch (fatalErr) {
    return { parsed: {}, errors: [{ reason: "processData-fatal", error: String(fatalErr) }] };
  }
}


function createJson(data, code) {
  // console.log("line 267", data, code);
  let JSON = {};

  if (code.toString() === "01") {
    const length = data.slice(3, 5);
    const names = data.slice(5);
    const [station_code, eng_name, hin_name] = names.split(":");
    return (JSON = { names, length, station_code, eng_name, hin_name });
  }

  if (code.toString() === "02") {
    const length = data.slice(3, 5);
    const names = data.slice(5);
    const [station_code, eng_name, hin_name] = names.split(":");
    return (JSON = { names, length, station_code, eng_name, hin_name });
  }

  if (code.toString() === "03") {
    // console.log("❌❌data_287: ", data);
    // const dateData = data.slice(4, 6); // old
    const dateData = data.slice(5, 7);
    return (JSON = { dateData });
  }

  if (code.toString() === "04") {
    // const monthData = data.slice(4, 6); // old
    const monthData = data.slice(5, 7);
    return (JSON = { monthData });
  }

  if (code.toString() === "05") {
    const start = 5;
    const end = data.indexOf(":", start);
    const adultData = data.slice(start, end === -1 ? undefined : end);
    //const adultData = data.slice(5, 7);
    return (JSON = { adultData });
  }

  if (code.toString() === "06") {
    const start = 5;
    const end = data.indexOf(":", start);
    const childData = data.slice(start, end === -1 ? undefined : end);
    //const childData = data.slice(5, 7);
    return (JSON = { childData });
  }

  if (code.toString() === "07") {
    const typeOfTrainData = data.slice(5, 6);
    // console.log(typeOfTrainData);
    return (JSON = trainTypes[typeOfTrainData]);
  }

  if (code === "09") {
    //console.log("❌❌data_298: ", data);
    const start = 5;
    const end = data.indexOf(":", start);
    const Class = data.slice(start, end === -1 ? undefined : end);

    return (JSON = { Class });
  }

  if (code === "13") {
    const clearDisplay = data.slice(5, 6);
    return (JSON = { clearDisplay });
  }

  function extractLengthAndData(data, start) {
    let lengthStr = "";
    let i = start;

    // Extract length (Stop when encountering a non-digit)
    while (i < data.length && /\d/.test(data[i])) {
      lengthStr += data[i];
      i++;
    }

    // Convert extracted length to an integer
    const length = parseInt(lengthStr, 10);
    // console.log("Extracted length:", length);

    // console.log("length: ", length);

    // Extract full data based on the length
    const fullData = data.slice(i, i + length);
    // console.log("fullData:", fullData);
    // console.log("fullData length:", fullData.length);

    // Validate length
    if (fullData.length === length) {
      // console.log("Matched!");
      const remaining = data.slice(i + length);
      if (remaining.startsWith(":^") || remaining.length === 0) {
        return fullData; // ✅ Correct length found
      }
    }

    return null; // Return null if extraction fails
  }

  function extractLengthAndData1(data, start) {
    let lengthStr = "";
    let i = start;

    // Extract length dynamically by progressively adding digits
    while (i < data.length) {
      lengthStr += data[i]; // Add next digit to length string
      i++;
      const length = parseInt(lengthStr, 10); // Convert to integer

      if (!isNaN(length) && length > 0 && data.length - i >= length) {
        const fullData = data.slice(i, i + length);
        if (fullData.length === length) {
          return fullData; // Correct length found
        }
      }
    }
    return null; // Return null if no match is found
  }

  if (code.toString() === "00") {
    const fullData = extractLengthAndData(data, 3);
    if (fullData) {
      const [data] = fullData.split(":");
      return (JSON = { data });
    }
  }

  if (code.toString() === "08") {
    // console.log(data);
    const fullData = extractLengthAndData1(data, 3);
    // console.log(fullData);
    if (fullData) {
      const [fareData] = fullData.split(":");
      return (JSON = { fareData });
    }
  }

  if (code === "12") {
    const fullData = extractLengthAndData(data, 3);
    if (fullData) {
      const [transactionTypeData] = fullData.split(":");
      const transactionType = transcationCode[transactionTypeData];
      return (JSON = { transactionType });
    }
  }

  if (code.toString() === "14") {
    const fullData = extractLengthAndData(data, 3);
    if (fullData) {
      const [codeData, type, amount] = fullData.split(":");
      const code = transcationCode[codeData];
      return (JSON = { code, type, amount });
    }
  }

  if (code.toString() === "15") {
    const fullData = extractLengthAndData(data, 3);
    if (fullData) {
      console.log("fullData_487: ", fullData);
      const [Operator, Terminal, WindowNo, ShiftNo] = fullData.split(":");
      return (JSON = { Operator, Terminal, WindowNo, ShiftNo });
    }
  }

  if (code.toString() === "17") {
    const fullData = extractLengthAndData(data, 3);
    if (fullData) {
      const [
        sourceStation2Code,
        sourceStation2NameEnglish,
        sourceStation2NameHindi,
      ] = fullData.split(":");
      return (JSON = {
        sourceStation2Code,
        sourceStation2NameEnglish,
        sourceStation2NameHindi,
      });
    }
  }

  if (code.toString() === "18") {
    const fullData = extractLengthAndData(data, 3);
    if (fullData) {
      const [
        sourceStation3Code,
        sourceStation3NameEnglish,
        sourceStation3NameHindi,
      ] = fullData.split(":");
      return (JSON = {
        sourceStation3Code,
        sourceStation3NameEnglish,
        sourceStation3NameHindi,
      });
    }
  }

  if (code.toString() === "19") {
    const fullData = extractLengthAndData(data, 3);
    if (fullData) {
      const [
        destinationStation2Code,
        destinationStation2NameEnglish,
        destinationStation2NameHindi,
      ] = fullData.split(":");
      return (JSON = {
        destinationStation2Code,
        destinationStation2NameEnglish,
        destinationStation2NameHindi,
      });
    }
  }

  if (code.toString() === "20") {
    const fullData = extractLengthAndData(data, 3);
    if (fullData) {
      const [
        destinationStation3Code,
        destinationStation3NameEnglish,
        destinationStation3NameHindi,
      ] = fullData.split(":");
      return (JSON = {
        destinationStation3Code,
        destinationStation3NameEnglish,
        destinationStation3NameHindi,
      });
    }
  }

  if (code.toString() === "21") {
    const fullData = extractLengthAndData(data, 3);
    if (fullData) {
      const [paymentGateway] = fullData.split(":");
      return (JSON = { paymentGateway });
    }
  }

  if (code.toString() === "22") {
    const fullData = extractLengthAndData(data, 3);
    if (fullData) {
      const [QRCode] = fullData.split(":");
      return (JSON = { QRCode });
    }
  }
}

// createJson("$0007thuts:^", "00");
// createJson("$030431:^", "03");
// createJson("$040412:^", "04");
// createJson("$050460:^", "05");
// createJson("$060404:^", "06");
// createJson("$0703E:^", "07");
// createJson("$0703S:^", "07");
// createJson("$0703O:^", "07");
// createJson("$0703T:^", "07");

// createJson("$08035:^", "08");
// createJson("$080414:^", "08");
// createJson("$0805544:^", "08");
// createJson("$08061004:^", "08");
// createJson("$080745604:^", "08");

// createJson("$0904 I:^", "09");
// createJson("$0904II:^", "09");

// createJson("$1204NI:^", "12");
// createJson("$1205BPT:^", "12");
// createJson("$1206PLAT:^", "12");

// createJson("$1303 :^", "13");

// createJson("$1415CANC:RFND:790:^", "14");

// createJson("$1525VENU GOPAL:NLDS99:105:3:^", "15");
// createJson("$1531GANESH KUMAR:ABCDEF9999:350:9:^", "15");

// createJson("$1726NDLS:NEW DELHI:NEW DELHI:^", "17");
// createJson("$1825HYD:HYDERABAD:HYDERABAD:^", "18");
// createJson("$1926NDLS:NEW DELHI:NEW DELHI:^", "19");
// createJson("$2034VSKP:VISAKHAPATNAM:VISAKHAPATNAM:^", "20");

// createJson("$2124www.sandbox.paypal.com:^", "21");

// createJson(
//   "$22414X8vGpZJ3LKqNmWTB4Y5rVf92DCHoQzaEsU6Mb1tPdjkhOlgXxIw7n0RYAcFeKZMuJVT3pGmB9q5LdNHCFXyO2aWKvs68rPDzAMJQ41tbYxRkVfT7ZCwGoNL3H2m9pYqK5XJMdFVBzCWT18Rt6YAowLNqO4GH7PDv2XKpM3JZ9fyN5LFQTCBWXVG68Rt1MAodHYqK2pG7JZMP4XNvGpZJ3LKqNmWTB4Y5rVf92DCHoQzaEsU6Mb1tPdjkhOlgXxIw7n0RYAcFeKZMuJVT3pGmB9q5LdNHCFXyO2aWKvs68rPDzAMJQ41tbYxRkVfT7ZCwGoNL3H2m9pYqK5XJMdFVBzCWT18Rt6YAowLNqO4GH7PDv2XKpM3JZ9fyN5LFQTCBWXVG68Rt1MAodHYqK2pG7JZMP4XN:^",
//   "22"
// );

// const data = "$0126NDLS:NEW DELHI:NEW DELHI:^$0226HYD:HYDERABAD:HYDERABAD:^";

// const data = "$080745604:^";
// const data =
//   "$0007thuts:^$030431:^$040412:^$050460:^$060404:^$0703S:^$080745604:^$0904II:^$1204NI:^$1205BPT:^$1206PLAT:^$1303 :^$1415CANC:RFND:790:^$1525VENU GOPAL:NLDS99:105:3:^$1531GANESH KUMAR:ABCDEF9999:350:9:^$1726NDLS:NEW DELHI:NEW DELHI:^$1825HYD:HYDERABAD:HYDERABAD:^$1926NDLS:NEW DELHI:NEW DELHI:^$2034VSKP:VISAKHAPATNAM:VISAKHAPATNAM:^$2124www.sandbox.paypal.com:^$22414X8vGpZJ3LKqNmWTB4Y5rVf92DCHoQzaEsU6Mb1tPdjkhOlgXxIw7n0RYAcFeKZMuJVT3pGmB9q5LdNHCFXyO2aWKvs68rPDzAMJQ41tbYxRkVfT7ZCwGoNL3H2m9pYqK5XJMdFVBzCWT18Rt6YAowLNqO4GH7PDv2XKpM3JZ9fyN5LFQTCBWXVG68Rt1MAodHYqK2pG7JZMP4XNvGpZJ3LKqNmWTB4Y5rVf92DCHoQzaEsU6Mb1tPdjkhOlgXxIw7n0RYAcFeKZMuJVT3pGmB9q5LdNHCFXyO2aWKvs68rPDzAMJQ41tbYxRkVfT7ZCwGoNL3H2m9pYqK5XJMdFVBzCWT18Rt6YAowLNqO4GH7PDv2XKpM3JZ9fyN5LFQTCBWXVG68Rt1MAodHYqK2pG7JZMP4XN:^";

const data =
  "$0126NDLS:NEW DELHI:NEW DELHI:^$0226HYD:HYDERABAD:HYDERABAD:^$0007thuts:^$030431:^$040412:^$050460:^$060404:^$0703S:^$080745604:^$0904II:^$1204NI:^$1205BPT:^$1206PLAT:^$1303 :^$1415CANC:RFND:790:^$1525VENU GOPAL:NLDS99:105:3:^$1531GANESH KUMAR:ABCDEF9999:350:9:^$1726NDLS:NEW DELHI:NEW DELHI:^$1825HYD:HYDERABAD:HYDERABAD:^$1926NDLS:NEW DELHI:NEW DELHI:^$2034VSKP:VISAKHAPATNAM:VISAKHAPATNAM:^$2124www.sandbox.paypal.com:^$22414X8vGpZJ3LKqNmWTB4Y5rVf92DCHoQzaEsU6Mb1tPdjkhOlgXxIw7n0RYAcFeKZMuJVT3pGmB9q5LdNHCFXyO2aWKvs68rPDzAMJQ41tbYxRkVfT7ZCwGoNL3H2m9pYqK5XJMdFVBzCWT18Rt6YAowLNqO4GH7PDv2XKpM3JZ9fyN5LFQTCBWXVG68Rt1MAodHYqK2pG7JZMP4XNvGpZJ3LKqNmWTB4Y5rVf92DCHoQzaEsU6Mb1tPdjkhOlgXxIw7n0RYAcFeKZMuJVT3pGmB9q5LdNHCFXyO2aWKvs68rPDzAMJQ41tbYxRkVfT7ZCwGoNL3H2m9pYqK5XJMdFVBzCWT18Rt6YAowLNqO4GH7PDv2XKpM3JZ9fyN5LFQTCBWXVG68Rt1MAodHYqK2pG7JZMP4XN:^";

// processData(data);

// module.exports = { CODES };
