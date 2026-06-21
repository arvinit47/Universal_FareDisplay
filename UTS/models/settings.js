const fs = require("fs").promises;
const path = require("path");

const filePath = path.join("./", "config", "config.json");

const getContentfromFile = async () => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content ? JSON.parse(content) : {};
  } catch (err) {
    console.error("error getSettingsFromFile", err);
    return {};
  }
};

class Settings {
  constructor(data) {
    this.data = data;
  }

  async save() {
    const content = await getContentfromFile();
    const updatedContent = { ...content, ...this.data };
    try {
      await fs.writeFile(filePath, JSON.stringify(updatedContent, null, 2));
      console.log("File saved successfully.");
      return 1;
    } catch (err) {
      console.error("Error saving file:", err);
      return 0;
    }
  }

  static async fetchData() {
    return await getContentfromFile();
  }
}

module.exports = Settings;
