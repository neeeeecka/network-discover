import { open, close, readFileSync, writeFile } from "fs";

/**
 *
 * @param {string} file
 * @returns {object} {.current .saveAsync}
 */
function Database(file) {
  const buffer = readFileSync(file);
  this.current = JSON.parse(buffer.toString());

  this.saveAsync = () => {
    writeFile(file, JSON.stringify(this.current));
  };
}

export default Database;
