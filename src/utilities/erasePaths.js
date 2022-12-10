import * as T from "three";

let line = [];
for (let z = -0.5; z <= 0.5; z += 0.005) {
  line.push(new T.Vector3(0.99, 1.35, z));
}

const erasePaths = {
  line: [line],
};

export default erasePaths;
