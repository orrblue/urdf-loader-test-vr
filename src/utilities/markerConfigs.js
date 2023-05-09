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

const markerTranslations = {
  sawyer: -0.2,
  ur5: -0.1,
  spotArm: -0.3,
  mobileSpotArm: -0.3,
};

const markerConfigs = {
  rotation: markerRotations,
  translation: markerTranslations,
};

export default markerConfigs;
