const CODES = {
  "00": { meaning: "Thin Client UTS", access: "thin_client_uts" },
  "01": { meaning: "Source Station", access: "source_station" },
  "02": { meaning: "Destination Station", access: "destination_station" },
  "03": { meaning: "Date", access: "date" },
  "04": { meaning: "Month", access: "month" },
  "05": { meaning: "Adult", access: "adult" },
  "06": { meaning: "Child", access: "child" },
  "07": { meaning: "Type Of Train", access: "type_of_trian" },
  "08": { meaning: "Fare", access: "fare" },
  "09": { meaning: "Class", access: "class" },
  "10": { meaning: "Route/Via", access: "route_via" },
  "11": { meaning: "Distance", access: "distance" },
  "12": { meaning: "Transaction type", access: "transaction_type" },
  "13": { meaning: "To clear Display device", access: "clear_display_device" },
  "14": { meaning: "Cancellation Refund amount", access: "cancellation_refund_amount" },
};

// Passenger fields mapping (Name, Gender, Age, Status)
for (let i = 0; i < 10; i++) {
  const base = 15 + i * 4;
  const pNum = i + 1;
  CODES[String(base)] = { meaning: `Passenger ${pNum} Name`, access: `p${pNum}_name` };
  CODES[String(base + 1)] = { meaning: `Passenger ${pNum} Gender`, access: `p${pNum}_gender` };
  CODES[String(base + 2)] = { meaning: `Passenger ${pNum} Age`, access: `p${pNum}_age` };
  CODES[String(base + 3)] = { meaning: `Passenger ${pNum} Status`, access: `p${pNum}_status` };
}

const PRS_CLASSES = {
  "1A": "AC First Class",
  "2A": "AC Two-Tier",
  "3A": "AC Three-Tier",
  "3E": "AC Three-Tier Economy",
  "SL": "Sleeper Class",
  "EC": "Executive Chair Car",
  "CC": "AC Chair Car",
  "2S": "Second Seater",
  "FC": "First Class",
  "EV": "Vistadome",
};

const PRS_QUOTAS = {
  "GN": "General Quota",
  "TQ": "Tatkal Quota",
  "PT": "Premium Tatkal Quota",
  "SS": "Senior Citizen Quota",
  "LD": "Ladies Quota",
  "DF": "Defence Quota",
  "HP": "Physically Handicapped Quota",
  "FT": "Foreign Tourist Quota",
  "HO": "HQ Quota",
  "PH": "Parliament House Quota",
  "DP": "Duty Pass Quota",
  "YU": "Yuva Quota",
};

const PRS_STATUSES = {
  "CNF": "Confirmed",
  "RAC": "Reservation Against Cancellation",
  "WL": "Waiting List",
  "GNWL": "General Waiting List",
  "RLWL": "Remote Location Waiting List",
  "PQWL": "Pooled Quota Waiting List",
  "TQWL": "Tatkal Waiting List",
  "RSWL": "Roadside Station Waiting List",
  "RQWL": "Request Waiting List",
  "CAN": "Cancelled",
  "NOSB": "No Seat Berth",
};

const GENDERS = {
  "M": "Male",
  "F": "Female",
  "T": "Transgender",
};

const UTS_CLASSES = {
  "II": "Second Class",
  "I": "First Class",
  "FC": "First Class",
  "SL": "Sleeper Class",
};

const PRS_CODES = {
  "01": "train_no",
  "02": "day",
  "03": "month",
  "04": "from_station",
  "05": "class",
  "06": "quota",
  "07": "to_station",
  "08": "passengers_count",
  "09": "boarding_station",
  "10": "reserved_upto",
  "11": "operator_code",
  "12": "operator_name",
  "14": "total_fare",
};

// Passenger fields mapping (Name, Gender, Age, Status)
// Note: PRS protocol often uses binary tags shifted by +12 for passenger fields
for (let i = 0; i < 10; i++) {
  const base = 15 + i * 4;
  const pNum = i + 1;

  // Standard/ASCII codes
  const sBase = String(base).padStart(2, '0');
  PRS_CODES[sBase] = `p${pNum}_name`;
  PRS_CODES[String(base + 1).padStart(2, '0')] = `p${pNum}_gender`;
  PRS_CODES[String(base + 2).padStart(2, '0')] = `p${pNum}_age`;
  PRS_CODES[String(base + 3).padStart(2, '0')] = `p${pNum}_status`;

  // Binary/Offset codes (+12)
  PRS_CODES[String(base + 12).padStart(2, '0')] = `p${pNum}_name`;
  PRS_CODES[String(base + 13).padStart(2, '0')] = `p${pNum}_gender`;
  PRS_CODES[String(base + 14).padStart(2, '0')] = `p${pNum}_age`;
  PRS_CODES[String(base + 15).padStart(2, '0')] = `p${pNum}_status`;
}

const trainTypes = {
  O: { value: "ORD", description: "ORDINARY" },
  E: { value: "M/E", description: "MAIL/EXP" },
  S: { value: "SUP", description: "SUPERFAST" },
  T: { value: "MMT", description: "MMTS" },
  C: { value: "COM", description: "COMBINED" },
  R: { value: "RAJ", description: "RAJDHANI" },
  D: { value: "SHT", description: "SHATABDI" },
  M: { value: "RMT", description: "RAIL MOTOR" },
  H: { value: "DHI", description: "DARJILLING HILL" },
  J: { value: "JAN", description: "JAN SHATABDI" },
  P: { value: "PRM", description: "PREMIUM SPL" },
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

function processData(raw) {
  if (!raw || typeof raw !== "string") return { parsed: {}, errors: ["input-empty"] };
  
  if (raw.startsWith("thPRS")) {
    return processPRS(raw);
  } else {
    return processUTS(raw);
  }
}

function processPRS(raw) {
  const parsed = { protocol: "PRS" };
  const errors = [];

  try {
    const subFunction = raw[raw.indexOf("thPRS") + 9];
    console.log(`[DEBUG] Parsing PRS SubFunction: ${subFunction}`);

    if (subFunction === "1") {
      parsed.type = "journey_details";
      const qIdx = raw.indexOf("Q");
      
      if (qIdx !== -1) {
        // Find where the length string ends
        let lenEndIdx = qIdx + 1;
        while (lenEndIdx < raw.length && /\d/.test(raw[lenEndIdx])) {
          lenEndIdx++;
        }
        
        // Data starts from the first byte after the length string
        const dataPart = raw.slice(lenEndIdx);
        
        // Use a binary-safe approach: The delimiters are bytes 0x01, 0x02, etc.
        // We can split the string using a Regex that looks for these control characters
        // Or iterate through the string and extract fields
        
        let currentIdx = 0;
        while (currentIdx < dataPart.length) {
          // The field code is a single byte (binary value)
          const codeByte = dataPart.charCodeAt(currentIdx);
          const fieldCode = String(codeByte).padStart(2, '0');
          
          // The separator is ':' at currentIdx + 1
          if (dataPart[currentIdx + 1] === ':') {
            // Find the end of this field (the next binary byte or end of string)
            // A binary byte is typically < 32 (non-printable)
            let valEnd = currentIdx + 2;
            while (valEnd < dataPart.length && dataPart.charCodeAt(valEnd) >= 32) {
              valEnd++;
            }
            
            const val = dataPart.slice(currentIdx + 2, valEnd).trim();
            const key = PRS_CODES[fieldCode];
            
            if (key) {
              if (key === "class") {
                parsed[key] = PRS_CLASSES[val] || val;
              } else if (key === "quota") {
                parsed[key] = PRS_QUOTAS[val] || val;
              } else if (key.endsWith("_gender")) {
                parsed[key] = GENDERS[val] || val;
              } else if (key.endsWith("_status")) {
                const statusPart = val.split(",")[0].trim();
                const mapped = PRS_STATUSES[statusPart];
                parsed[key] = mapped ? val.replace(statusPart, mapped) : val;
              } else {
                parsed[key] = val;
              }
            } else {
              parsed[`field_${fieldCode}`] = val;
            }
            
            currentIdx = valEnd;
          } else {
            currentIdx++;
          }
        }
      }
    }
    // ... handling for other sub-functions if they also follow binary format
    return { parsed, errors: errors.length ? errors : null };
  } catch (err) {
    console.error("[DEBUG] processPRS Error:", err);
    return { parsed: {}, errors: [String(err)] };
  }
}

function processUTS(raw) {
  const parsed = { protocol: "UTS" };
  const errors = [];

  try {
    const normalized = raw.replace(/\r/g, "").replace(/\n/g, "");
    const frameRegex = /\$[^$^]*?\^/g;
    const frames = normalized.match(frameRegex) || [];

    if (frames.length === 0) return { parsed, errors: ["no-complete-frames"] };

    frames.forEach((frame) => {
      try {
        const f = frame.replace(/^\${2,}/, "$");
        const code = f.slice(1, 3);
        const spec = CODES[code];

        if (!spec) {
          errors.push({ frame, code, reason: "unknown-code" });
          return;
        }

        const dataPart = f.slice(5, -1);
        const obj = createJson(code, dataPart);
        
        if (obj) {
          parsed[spec.access] = obj;
        }
      } catch (err) {
        errors.push({ frame, reason: "processing-error", error: String(err) });
      }
    });

    return { parsed, errors: errors.length ? errors : null };
  } catch (fatalErr) {
    return { parsed: {}, errors: [String(fatalErr)] };
  }
}

function createJson(code, data) {
  const cleanData = data.endsWith(':') ? data.slice(0, -1) : data;

  switch (code) {
    case "00":
      return { data: cleanData };
    case "01":
    case "02":
    case "17":
    case "18":
    case "19":
    case "20":
      const [station_code, eng_name, hin_name] = cleanData.split(":");
      return { station_code, eng_name, hin_name };
    case "03":
      return { dateData: cleanData };
    case "04":
      return { monthData: cleanData };
    case "05":
      return { adultData: cleanData };
    case "06":
      return { childData: cleanData };
    case "07":
      return trainTypes[cleanData] || { value: cleanData, description: "UNKNOWN" };
    case "08":
      return { fareData: cleanData };
    case "09":
      return { Class: UTS_CLASSES[cleanData] || cleanData };
    case "12":
      return { transactionType: transcationCode[cleanData] || cleanData };
    case "13":
      return { clearDisplay: true };
    case "14":
      const parts = cleanData.split(":");
      if (parts.length === 3) {
        const [cancCode, type, amount] = parts;
        return { code: transcationCode[cancCode] || cancCode, type, amount };
      }
      return { fareData: cleanData };
    default:
      const numCode = parseInt(code, 10);
      if (numCode >= 15 && numCode <= 54) {
        return cleanData;
      }
      return { raw: cleanData };
  }
}

function mapPRSFields(numericData) {
  const parsed = { protocol: "PRS", type: "journey_details" };
  for (const [fieldCode, val] of Object.entries(numericData)) {
    const key = PRS_CODES[fieldCode];
    if (key) {
      if (key === "class") {
        parsed[key] = PRS_CLASSES[val] || val;
      } else if (key === "quota") {
        parsed[key] = PRS_QUOTAS[val] || val;
      } else if (key.endsWith("_gender")) {
        parsed[key] = GENDERS[val] || val;
      } else if (key.endsWith("_status")) {
        const statusPart = val.split(",")[0].trim();
        const mapped = PRS_STATUSES[statusPart];
        parsed[key] = mapped ? val.replace(statusPart, mapped) : val;
      } else {
        parsed[key] = val;
      }
    } else {
      parsed[`field_${fieldCode}`] = val;
    }
  }
  return parsed;
}

module.exports = { processData, mapPRSFields };
