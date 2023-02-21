import * as T from "three";
import URDFLoader from "../urdf-loader";
import init from "./utilities/init";
import * as yaml from "js-yaml";
import { getURDFFromURL } from "./utilities/loaders";
import initRelaxedIK, {
  RelaxedIK,
} from "../relaxed_ik_web/pkg/relaxed_ik_web.js";
import ThreeMeshUI from "three-mesh-ui";
import Control from "./components/Control.js";
import { Data } from "./components/Data";
import { UI } from "./components/UI";
import { recurseMaterialTraverse } from "./utilities/robot";
import RAPIER from "@dimforge/rapier3d";

/**
 * Adds the robot to the scene, sets initial joint values, and initializes RelaxedIK
 *
 * @param {String} file
 * @param {String} info
 * @param {String} nn
 * @param {Boolean} loadScreen
 */
function loadRobot(
  name,
  file,
  info,
  nn,
  settings,
  loadScreen = false,
  init = false
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
    robot.position.y = 0.05;
    robot.position.x = 0.2;
    // robot.position.z = .3;
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

    window.robots[name].robotColliders = {};
    window.robots[name].gripperColliders = [];

    initRelaxedIK().then(async () => {
      window.robots[name].robotInfo = yaml.load(
        await fetch(info).then((response) => response.text())
      );
      window.robots[name].robotNN = yaml.load(
        await fetch(nn).then((response) => response.text())
      );
      window.robots[name].settings = yaml.load(
        await fetch(settings).then((response) => response.text())
      );

      const joints = Object.entries(window.robots[name].robot.joints).filter(
        (joint) =>
          joint[1]._jointType != "fixed" && joint[1].type != "URDFMimicJoint"
      );
      joints.forEach((joint) => {
        const jointIndex = window.robots[name].robotInfo.joint_ordering.indexOf(
          joint[0]
        );
        if (jointIndex != -1)
          window.robots[name].robot.setJointValue(
            joint[0],
            window.robots[name].robotInfo.starting_config[jointIndex]
          );
      });

      window.robots[name].relaxedIK = new RelaxedIK(
        window.robots[name].robotInfo,
        window.robots[name].robotNN,
        window.robots[name].settings
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
                //scene.add(visualGroup);
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
          //scene.add(visualGroup);
          window.robots[name].robotObjs.set(rigidBody, visualGroup);
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

      if (init) {
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
  window.robot = window.robots[name].robot;
  window.robotName = window.robots[name].robotName;
  window.robotColliders = window.robots[name].robotColliders;
  window.gripperColliders = window.robots[name].gripperColliders;
  window.robotInfo = window.robots[name].robotInfo;
  window.robotNN = window.robots[name].robotNN;
  window.settings = window.robots[name].settings;
  window.relaxedIK = window.robots[name].relaxedIK;
  window.linkToRigidBody = window.robots[name].linkToRigidBody;
  window.robotObjs = window.robots[name].robotObjs;
  window.leftFinger = window.robots[name].leftFinger;
  window.rightFinger = window.robots[name].rightFinger;
  window.robotObjs.forEach((visualGroup, rigidBody) => scene.add(visualGroup));
  window.robotObjs.forEach((visualGroup, rigidBody) =>
    window.simObjs.set(rigidBody, visualGroup)
  );
};

///////////////////////////////////////////////////////////

const [scene, camera, renderer, camControls] = init();
window.scene = scene;
window.camera = camera;

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
window.simObjs = new Map();
window.robots = {};

// load robot
const robots = {
  sawyer: {
    info: "https://raw.githubusercontent.com/uwgraphics/relaxed_ik_core/collision-ik/config/info_files/sawyer_info.yaml",
    nn: "https://raw.githubusercontent.com/uwgraphics/relaxed_ik_core/collision-ik/config/collision_nn_rust/sawyer_nn.yaml",
    settings:
      "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/relaxed_ik_web/sawyer_env_settings.yaml",
  },
  ur5: {
    info: "https://raw.githubusercontent.com/yepw/robot_configs/master/info_files/ur5_gripper_info.yaml",
    nn: "https://raw.githubusercontent.com/yepw/robot_configs/master/collision_nn_rust/ur5_nn.yaml",
    settings:
      "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/relaxed_ik_web/ur5_env_settings.yaml",
  },
  spot: {
    info: "https://raw.githubusercontent.com/uwgraphics/relaxed_ik_core/collision-ik/config/info_files/sawyer_info.yaml",
    nn: "https://raw.githubusercontent.com/yepw/robot_configs/master/collision_nn_rust/ur5_nn.yaml",
    settings:
      "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/relaxed_ik_web/ur5_env_settings.yaml",
  },
};

getURDFFromURL(
  "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/robot_descriptions/sawyer_description/urdf/sawyer_gripper.urdf",
  (blob) => {
    robots.sawyer.file = URL.createObjectURL(blob);
    loadRobot(
      "sawyer",
      robots.sawyer.file,
      robots.sawyer.info,
      robots.sawyer.nn,
      robots.sawyer.settings,
      true,
      false
    );
  }
);

getURDFFromURL(
  "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/robot_descriptions/ur5_description/urdf/ur5_gripper.urdf",
  (blob) => {
    robots.ur5.file = URL.createObjectURL(blob);
    loadRobot(
      "ur5",
      robots.ur5.file,
      robots.ur5.info,
      robots.ur5.nn,
      robots.ur5.settings,
      true,
      true
    );
  }
);

getURDFFromURL(
  "https://raw.githubusercontent.com/kjoseph8/urdf-loader-test-vr/master/robot_descriptions/spot_arm/urdf/spot_arm.urdf",
  (blob) => {
    robots.spot.file = URL.createObjectURL(blob);
    loadRobot(
      "spot",
      robots.spot.file,
      robots.spot.info,
      robots.spot.nn,
      robots.spot.settings,
      true,
      false
    );
  }
);

async function someInit(name) {
  window.setRobot(name);

  document.querySelector("#toggle-physics").onclick = function () {
    if (lines.parent === scene) scene.remove(lines);
    else scene.add(lines);
  };

  document.querySelector("#toggle-robot").onclick = function () {
    if (window.robot.parent === scene) scene.remove(window.robot);
    else scene.add(window.robot);
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

  // render loop
  renderer.setAnimationLoop(function () {
    ThreeMeshUI.update();
    control.teleportvr?.update();
    renderer.render(scene, camera);
  });
}
