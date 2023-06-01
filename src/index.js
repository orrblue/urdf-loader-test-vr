import * as T from "three";
import URDFLoader from "../urdf-loader";
import init from "./utilities/init";
import * as yaml from "js-yaml";
import { getURDFFromURL } from "./utilities/loaders";
import initRelaxedIK, {
  RelaxedIK,
} from "../relaxed_ik_core/pkg/relaxed_ik_lib.js";
import ThreeMeshUI from "three-mesh-ui";
import Control from "./components/Control.js";
import { Data } from "./components/Data";
import { UI } from "./components/UI";
import {
  recurseMaterialTraverse,
  getCurrEEPose,
  updateRobot,
} from "./utilities/robot";
import RAPIER from "@dimforge/rapier3d";

/**
 * Adds the robot to the scene, sets initial joint values, and initializes RelaxedIK
 *
 * @param {String} file
 * @param {String} config_link
 * @param {String} urdf_link
 * @param {Boolean} loadScreen
 */
function loadRobot(
  name,
  file,
  config_link,
  urdf_link,
  loadScreen = false,
  defaultPosi = new T.Vector3(0.2, 0.05, 0),
  fpCamOffset = new T.Vector3(-0.15, 1.5, 0)
) {
  const loader = new URDFLoader(
    loadScreen
      ? new T.LoadingManager(() => {
          const loadingScreen = document.querySelector("#loading-screen");
          if (loadingScreen) {
            loadingScreen.classList.add("fade-out");
            loadingScreen.addEventListener("transitionend", (e) =>
              e.target.remove()
            );
          }
        })
      : null
  );

  loader.parseCollision = true;
  loader.parseVisual = true;
  // loader.parseInertial = true;

  loader.load(file, (robot) => {
    robot.rotation.x = -Math.PI / 2;
    robot.position.copy(defaultPosi);
    robot.updateMatrix();

    robot.traverse((c) => {
      c.castShadow = true;
      c.recieveShadow = true;

      if (c.type == "PointLight") {
        c.intensity = 0;
        c.castShadow = false;
        c.distance = 0;
      }

      if (c.material) {
        recurseMaterialTraverse(c.material, (material) => {
          material.alphaToCoverage = true;
          material.transparent = true;
          material.side = T.DoubleSide;
        });
      }
    });

    window.robots[name] = {};
    window.robots[name].robot = robot;
    window.robots[name].robotName = name;
    window.robots[name].robotGroup = new T.Group();
    window.robots[name].robot.visible = false;
    window.robots[name].robotGroup.add(window.robots[name].robot);
    window.robots[name].fpCamOffset = fpCamOffset;

    window.robots[name].robotColliders = {};
    window.robots[name].gripperColliders = [];

    initRelaxedIK().then(async () => {
      window.robots[name].configs = yaml.load(
        await fetch(config_link).then((response) => response.text())
      );
      window.robots[name].urdf = await fetch(urdf_link).then((response) =>
        response.text()
      );

      const joints = Object.entries(window.robots[name].robot.joints).filter(
        (joint) =>
          joint[1]._jointType != "fixed" && joint[1].type != "URDFMimicJoint"
      );
      joints.forEach((joint) => {
        const jointIndex = window.robots[name].configs.joint_ordering.indexOf(
          joint[0]
        );
        if (jointIndex != -1)
          window.robots[name].robot.setJointValue(
            joint[0],
            window.robots[name].configs.starting_config[jointIndex]
          );
      });

      window.robots[name].relaxedIK = new RelaxedIK(
        window.robots[name].configs,
        window.robots[name].urdf
      );
      console.log("%cSuccessfully loaded robot config.", "color: green");

      window.robots[name].linkToRigidBody = new Map();
      window.robots[name].robotObjs = new Map();

      function initRobotPhysics(currJoint) {
        if (
          currJoint.type === "URDFJoint" ||
          currJoint.type === "URDFMimicJoint"
        ) {
          currJoint.children.forEach((childLink) => {
            if (childLink.type == "URDFLink") {
              const urdfColliders = [];

              let urdfVisual;
              childLink.children.forEach((grandChild) => {
                if (grandChild.type === "URDFCollider") {
                  urdfColliders.push(grandChild);
                } else if (grandChild.type === "URDFVisual") {
                  if (!urdfVisual) urdfVisual = grandChild;
                  else console.warn("Multiple URDF Visual found!");
                }
              });

              const position = childLink.getWorldPosition(new T.Vector3());
              const quaternion = childLink.getWorldQuaternion(
                new T.Quaternion()
              );

              const rigidBodyDesc =
                RAPIER.RigidBodyDesc.kinematicPositionBased()
                  .setTranslation(position.x, position.y, position.z)
                  .setRotation(quaternion);
              const rigidBody = world.createRigidBody(rigidBodyDesc);

              if (urdfVisual) {
                urdfVisual.traverse((child) => {
                  child.castShadow = true;
                  child.recieveShadow = true;
                });

                const visualGroup = new T.Group();
                visualGroup.add(urdfVisual);
                window.robots[name].robotObjs.set(rigidBody, visualGroup);
              }

              if (
                urdfColliders.length != 0 &&
                childLink.name !== "finger_tip"
              ) {
                const colliders = [];

                for (const urdfCollider of urdfColliders) {
                  const colliderMeshes = [];
                  urdfCollider.traverse((child) => {
                    if (child.type === "Mesh") colliderMeshes.push(child);
                  });
                  // let colliderMeshes = recursivelyFindMesh(urdfCollider);
                  if (colliderMeshes.length != 1) {
                    console.warn(
                      "No collider mesh or multiple collider meshes were found under: "
                    );
                    return;
                  }

                  const colliderMesh = colliderMeshes[0];
                  const vertices = colliderMesh.geometry
                    .getAttribute("position")
                    .array.slice();

                  for (let i = 0; i < vertices.length; i += 3) {
                    vertices[i] *= colliderMesh.scale.x;
                    vertices[i + 1] *= colliderMesh.scale.y;
                    vertices[i + 2] *= colliderMesh.scale.z;
                  }

                  let indices = colliderMesh.geometry.index;
                  if (!indices) {
                    // unindexed bufferedgeometry
                    indices = [...Array(vertices.count).keys()];
                  }

                  const position = new T.Vector3();
                  position.addVectors(
                    urdfCollider.position,
                    colliderMesh.position
                  );
                  const quaternion = new T.Quaternion();
                  quaternion.multiplyQuaternions(
                    urdfCollider.quaternion,
                    colliderMesh.quaternion
                  );

                  const colliderDesc = RAPIER.ColliderDesc.trimesh(
                    vertices,
                    indices.array
                  )
                    .setTranslation(position.x, position.y, position.z)
                    .setRotation(quaternion);
                  try {
                    const collider = world.createCollider(
                      colliderDesc,
                      rigidBody
                    );
                    collider.setActiveEvents(
                      RAPIER.ActiveEvents.COLLISION_EVENTS
                    );
                    colliders.push(collider);
                  } catch {}
                }

                window.robots[name].robotColliders[childLink.name] = colliders;
              }

              if (
                childLink.name === "right_gripper_l_finger" ||
                childLink.name === "left_outer_finger"
              ) {
                window.robots[name].leftFinger = { rigidBody, link: childLink };
              }

              if (
                childLink.name === "right_gripper_r_finger" ||
                childLink.name === "right_outer_finger"
              ) {
                window.robots[name].rightFinger = {
                  rigidBody,
                  link: childLink,
                };
              }

              window.robots[name].linkToRigidBody.set(childLink, rigidBody);
              childLink.children.forEach((joint) => {
                initRobotPhysics(joint);
              });
            }
          });
        } else if (currJoint.type === "URDFVisual") {
          let urdfVisual = currJoint;

          urdfVisual.traverse((child) => {
            child.castShadow = true;
            child.recieveShadow = true;
          });

          const visualGroup = new T.Group();
          visualGroup.add(urdfVisual);
          visualGroup.rotateX(-Math.PI / 2);
          visualGroup.position.copy(defaultPosi);
          window.robots[name].robotGroup.add(visualGroup);
        }
      }

      const position = robot.getWorldPosition(new T.Vector3());
      const quaternion = robot.getWorldQuaternion(new T.Quaternion());
      const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setRotation(quaternion);
      const rigidBody = world.createRigidBody(rigidBodyDesc);

      robot.children.forEach((joint) => {
        initRobotPhysics(joint);
      });

      if (name == window.robotName) {
        someInit(name);
      }
    });
  });
}

window.setRobot = (name) => {
  window.robotObjs.forEach((visualGroup, rigidBody) =>
    window.simObjs.delete(visualGroup)
  );
  window.robotObjs.forEach((visualGroup, rigidBody) =>
    scene.remove(visualGroup)
  );
  scene.remove(window.robotGroup);
  window.robotGroup.remove(window.initEEAbsThree);
  window.robot = window.robots[name].robot;
  window.robotName = window.robots[name].robotName;
  window.fpCamOffset = window.robots[name].fpCamOffset;
  window.robotColliders = window.robots[name].robotColliders;
  window.gripperColliders = window.robots[name].gripperColliders;
  window.robotConfigs = window.robots[name].configs;
  window.relaxedIK = window.robots[name].relaxedIK;
  window.linkToRigidBody = window.robots[name].linkToRigidBody;
  window.robotObjs = window.robots[name].robotObjs;
  window.robotGroup = window.robots[name].robotGroup;
  window.leftFinger = window.robots[name].leftFinger;
  window.rightFinger = window.robots[name].rightFinger;
  window.robotGroup.add(window.initEEAbsThree);
  scene.add(window.robotGroup);
  window.robotObjs.forEach((visualGroup, rigidBody) => scene.add(visualGroup));
  window.robotObjs.forEach((visualGroup, rigidBody) =>
    window.simObjs.set(rigidBody, visualGroup)
  );
};

window.setMobileIK = (active) => {
  /*
  let result = window.ikResult;
  if (active && window.robotName == "spotArm") {
    window.setRobot("mobileSpotArm");
    result.splice(0, 0, 0, 0, 0);
  } else if (!active && window.robotName == "mobileSpotArm") {
    window.setRobot("spotArm");
    const pose = result.splice(0, 3);
    window.robotGroup.translateX(pose[0]);
    window.robotGroup.translateZ(-pose[1]);
    window.robotGroup.rotateY(pose[2]);
  } else {
    return;
  }
  window.relaxedIK.reset(result);
  window.goalEERelThree.position.copy(new T.Vector3());
  window.goalEERelThree.quaternion.copy(new T.Quaternion().identity());
  updateRobot();
  const eePosi = getCurrEEPose().posi;
  eePosi.applyQuaternion(window.robotGroup.quaternion);
  eePosi.sub(window.robotGroup.position);
  window.initEEAbsThree.position.copy(eePosi);
  */
};

///////////////////////////////////////////////////////////

const [scene, camera, renderer, camControls] = init();
window.scene = scene;
window.camera = camera;
window.renderer = renderer;

const gravity = { x: 0.0, y: -9.81, z: 0.0 };
const world = new RAPIER.World(gravity);

const groundDesc = RAPIER.RigidBodyDesc.fixed();
const groundRigidBody = world.createRigidBody(groundDesc);
// let currCollisionGroup_membership = 0x0001;
const groundColliderDesc = RAPIER.ColliderDesc.cuboid(
  10.0,
  0.1,
  10.0
).setDensity(2.0);
const ground = world.createCollider(groundColliderDesc, groundRigidBody);
// const robotCollisionGroups = 0x00010002;
const groundCollisionGroups = 0x00020001;
ground.setCollisionGroups(groundCollisionGroups);

window.robotObjs = new Map();
window.robotGroup = new T.Group();
window.robot = new T.Group();
window.robotGroup.add(window.robot);
window.simObjs = new Map();
window.robots = {};

// End Effector Goal
window.initEEAbsThree = new T.Group();
window.goalEERelThree = new T.Mesh(
  new T.SphereGeometry(0.015, 32, 32),
  new T.MeshBasicMaterial({ color: 0xffffff })
);
window.goalEERelThree.renderOrder = Infinity;
window.goalEERelThree.material.depthTest = false;
window.goalEERelThree.material.depthWrite = false;
window.initEEAbsThree.add(window.goalEERelThree);
window.robotGroup.add(window.initEEAbsThree);

window.adjustedControl = (goal) => {
  return {
    posi: goal.position.clone(),
    ori: goal.quaternion.clone(),
  };
};

window.firstPerson = false;
window.fpLockedCamera = false;

// load robot
const robots = {
  sawyer: {
    config:
      "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/robot_descriptions/sawyer/sawyer.yaml",
    urdf: "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/robot_descriptions/sawyer/urdf/sawyer_gripper.urdf",
  },
  ur5: {
    config:
      "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/robot_descriptions/ur5/ur5.yaml",
    urdf: "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/robot_descriptions/ur5/urdf/ur5_gripper.urdf",
  },
  spotArm: {
    config:
      "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/robot_descriptions/spot_arm/spot_arm.yaml",
    urdf: "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/robot_descriptions/spot_arm/urdf/spot_arm.urdf",
  },
  mobileSpotArm: {
    config:
      "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/robot_descriptions/mobile_spot_arm/mobile_spot_arm.yaml",
    urdf: "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/robot_descriptions/mobile_spot_arm/urdf/mobile_spot_arm.urdf",
  },
};

// Set the starting robot
window.robotName = "spotArm";

getURDFFromURL(robots.sawyer.urdf, (blob) => {
  robots.sawyer.file = URL.createObjectURL(blob);
  loadRobot(
    "sawyer",
    robots.sawyer.file,
    robots.sawyer.config,
    robots.sawyer.urdf,
    true,
    new T.Vector3(0.2, 0.05, 0),
    new T.Vector3(0.15, 1.5, 0)
  );
});

getURDFFromURL(robots.ur5.urdf, (blob) => {
  robots.ur5.file = URL.createObjectURL(blob);
  loadRobot(
    "ur5",
    robots.ur5.file,
    robots.ur5.config,
    robots.ur5.urdf,
    true,
    new T.Vector3(0.2, 0.75, 0),
    new T.Vector3(0.2, 1.5, 0)
  );
});

getURDFFromURL(robots.spotArm.urdf, (blob) => {
  robots.spotArm.file = URL.createObjectURL(blob);
  loadRobot(
    "spotArm",
    robots.spotArm.file,
    robots.spotArm.config,
    robots.spotArm.urdf,
    true,
    new T.Vector3(0.2, 0.5, 0),
    new T.Vector3(0.5, 1.2, 0)
  );
});

getURDFFromURL(robots.mobileSpotArm.urdf, (blob) => {
  robots.mobileSpotArm.file = URL.createObjectURL(blob);
  loadRobot(
    "mobileSpotArm",
    robots.mobileSpotArm.file,
    robots.mobileSpotArm.config,
    robots.mobileSpotArm.urdf,
    true,
    new T.Vector3(0.2, 0.5, 0),
    new T.Vector3(0.5, 1.2, 0)
  );
});

async function someInit(name) {
  window.setRobot(name);

  document.querySelector("#toggle-physics").onclick = function () {
    if (lines.parent === scene) scene.remove(lines);
    else scene.add(lines);
  };

  document.querySelector("#toggle-robot").onclick = function () {
    window.robot.visible = !window.robot.visible;
  };

  const data = new Data();

  const ui = new UI();

  const control = await Control.init({
    camera,
    renderer,
    data,
    ui,
    world,
    ground,
  });

  // logic loop
  setTimeout(function update() {
    if (renderer.xr.isPresenting) {
      // only update and log data if user is in VR
      const t = Date.now();
      control.update(t);
      //control.log(t);
    }

    setTimeout(update, 5);
  }, 5);

  // physics loop
  let lines;
  setTimeout(function update() {
    const events = new RAPIER.EventQueue(true);
    world.step(events);

    // control.updatePhysics(events);
    window.simObjs.forEach((mesh, rigidBody) => {
      const position = rigidBody.translation();
      mesh.position.set(position.x, position.y, position.z);

      const quaternion = rigidBody.rotation();
      mesh.quaternion.set(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      );

      mesh.updateMatrix();
    });

    if (!lines) {
      lines = new T.LineSegments(
        new T.BufferGeometry(),
        new T.LineBasicMaterial({
          color: 0xffffff,
          vertexColors: T.VertexColors,
        })
      );

      lines.renderOrder = Infinity;
      lines.material.depthTest = false;
      lines.material.depthWrite = false;
      // scene.add(lines);
    }

    const buffers = world.debugRender();
    lines.geometry.setAttribute(
      "position",
      new T.BufferAttribute(buffers.vertices, 3)
    );
    lines.geometry.setAttribute(
      "color",
      new T.BufferAttribute(buffers.colors, 4)
    );

    setTimeout(update, 16);
  });

  let time = 0;

  // render loop
  renderer.setAnimationLoop(function (timestamp) {
    window.deltaTime = timestamp - time;
    time = timestamp;
    ThreeMeshUI.update();
    control.teleportvr?.update();
    renderer.render(scene, camera);
  });
}
