import * as T from "three";

let line = [];
for (let z = -0.5; z <= 0.5; z += 0.001) {
  line.push(new T.Vector3(0.99, 1.35, z));
}

let rows = [];
for (let y = 0.85; y < 1.85; y += 0.05) {
  let row = [];
  for (let z = -0.5; z <= 0.5; z += 0.05) {
    row.push(new T.Vector3(0.99, y, z));
  }
  rows.push(row);
}

let cols = [];
for (let z = -0.5; z <= 0.5; z += 0.05) {
  let col = [];
  for (let y = 0.85; y < 1.85; y += 0.05) {
    col.push(new T.Vector3(0.99, y, z));
  }
  cols.push(col);
}

const erasePaths = {
  line: [line],
  rows: rows,
  cols: cols,
};

export default erasePaths;
