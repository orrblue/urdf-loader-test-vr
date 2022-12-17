import * as T from "three";

let line = [];
for (let z = -0.5; z <= 0.5; z += 0.001) {
  line.push(new T.Vector3(0.99, 1.35, z));
}

let rows = [];
let grid = [];
for (let y = 0.9; y <= 1.8; y += 0.05) {
  let row = [];
  for (let z = -0.5; z <= 0.5; z += 0.005) {
    row.push(new T.Vector3(0.99, y, z));
  }
  rows.push(row);
  grid.push(row);
}

let cols = [];
for (let z = -0.5; z <= 0.5; z += 0.05) {
  let col = [];
  for (let y = 0.9; y <= 1.8; y += 0.005) {
    col.push(new T.Vector3(0.99, y, z));
  }
  cols.push(col);
  grid.push(col);
}

let zigzag = [];
for (let z = -0.5; z <= 0.5; z += 0.005) {
  zigzag.push(new T.Vector3(0.99, 1.6, z));
}
for (let y = 1.595; y > 1.35; y -= 0.005) {
  zigzag.push(new T.Vector3(0.99, y, 0.5));
}
for (let z = 0.5; z >= -0.5; z -= 0.005) {
  zigzag.push(new T.Vector3(0.99, 1.35, z));
}
for (let y = 1.345; y > 1.1; y -= 0.005) {
  zigzag.push(new T.Vector3(0.99, y, -0.5));
}
for (let z = -0.5; z <= 0.5; z += 0.005) {
  zigzag.push(new T.Vector3(0.99, 1.1, z));
}

const erasePaths = {
  line: [line],
  rows: rows,
  cols: cols,
  grid: grid,
  zigzag: [zigzag],
};

export default erasePaths;
