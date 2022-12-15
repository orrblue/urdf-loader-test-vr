import * as T from "three";

let line = [];
for (let z = -0.5; z <= 0.5; z += 0.001) {
  line.push(new T.Vector3(0.99, 1.35, z));
}

let filled = [];
for (let y = 0.85; y < 1.85; y += 0.001) {
  let row = [];
  for (let z = -0.5; z <= 0.5; z += 0.001) {
    row.push(new T.Vector3(0.99, y, z));
  }
  filled.push(row);
}

const erasePaths = {
  line: [line],
  filled: filled,
};

export default erasePaths;
