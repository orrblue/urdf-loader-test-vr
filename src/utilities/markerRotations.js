import * as T from "three";

const markerRotations = {
  sawyer: new T.Quaternion(
    Math.sin(-Math.PI / 4),
    0,
    0,
    Math.cos(-Math.PI / 4)
  ),
  ur5: new T.Quaternion(Math.sin(-Math.PI / 4), 0, 0, Math.cos(-Math.PI / 4)),
  spotArm: new T.Quaternion(Math.sin(Math.PI / 2), 0, 0, Math.cos(Math.PI / 2)),
  mobileSpotArm: new T.Quaternion(
    Math.sin(Math.PI / 2),
    0,
    0,
    Math.cos(Math.PI / 2)
  ),
};

export default markerRotations;
