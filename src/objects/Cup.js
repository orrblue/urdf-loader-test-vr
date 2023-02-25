import * as T from "three";
import RAPIER from "@dimforge/rapier3d";
import { loadGLTF } from "../utilities/loaders";
import SceneObject from "./SceneObject";

const PATH = "./models/cup.glb";

export default class Cup extends SceneObject {
  constructor(params, options = {}) {
    super("cup", params);

    this.initPosition = options.position ?? new T.Vector3();
    this.initRotation = options.rotation ?? new T.Euler(0, Math.PI / 2, 0);
    this.initScale = options.scale ?? new T.Vector3(1, 1, 1);

    this.color = options.color ?? 0xff0000;
    this.loaded = false;
    this.grasped = false;

    this.size = new T.Vector3(
      0.1 * this.initScale.x,
      0.1 * this.initScale.y,
      0.1 * this.initScale.z
    );
    this.thickness = 0.01;
  }

  static async init(params) {
    const cup = new Cup(params);
    await cup.fetch();
    return cup;
  }

  async fetch() {
    const gltf = await loadGLTF(PATH);
    const mesh = gltf.scene;

    // position and rotation will be overridden by the physics engine
    // these values are set here to prevent teleporting on load
    mesh.position.copy(this.initPosition);
    mesh.rotation.copy(this.initRotation);
    mesh.scale.copy(this.initScale);
    mesh.traverse((child) => {
      (child.castShadow = true), (child.receiveShadow = true);
    });

    this.meshes = [mesh];
  }

  /**
   *
   * @param {string} type
   * @param {T.Vector3} initPosition
   * @param {T.Quaternion} initRotation
   */
  load(type = "dynamic", initPosition, initRotation) {
    const position = initPosition ?? this.initPosition;
    const rotation =
      initRotation ?? new T.Quaternion().setFromEuler(this.initRotation);

    const rigidBodyDesc = (
      type === "dynamic"
        ? RAPIER.RigidBodyDesc.dynamic()
        : type === "kinematicPositionBased"
        ? RAPIER.RigidBodyDesc.kinematicPositionBased()
        : undefined
    )
      ?.setTranslation(position.x, position.y, position.z)
      .setRotation(rotation);
    /*
    const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x, position.y, position.z)
      .setRotation(rotation);
*/
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // build colliders
    const colliderDescs = [
      // bottom
      RAPIER.ColliderDesc.cuboid(
        this.size.x / 2,
        this.thickness / 2,
        this.size.z / 2
      ).setTranslation(0, -this.size.y / 2, 0),
      // sides
      RAPIER.ColliderDesc.cuboid(
        this.thickness / 2,
        this.size.y / 2,
        this.size.z / 2
      ).setTranslation(this.size.x / 2, 0, 0),
      RAPIER.ColliderDesc.cuboid(
        this.thickness / 2,
        this.size.y / 2,
        this.size.z / 2
      ).setTranslation(-this.size.x / 2, 0, 0),
      RAPIER.ColliderDesc.cuboid(
        this.size.x / 2,
        this.size.y / 2,
        this.thickness / 2
      ).setTranslation(0, 0, this.size.z / 2),
      RAPIER.ColliderDesc.cuboid(
        this.size.x / 2,
        this.size.y / 2,
        this.thickness / 2
      ).setTranslation(0, 0, -this.size.z / 2),
    ];

    const colliders = [];
    for (const [index, colliderDesc] of colliderDescs.entries()) {
      let collider = this.world.createCollider(colliderDesc, rigidBody);
      colliders.push(collider);
    }

    const handleColliderDesc = RAPIER.ColliderDesc.cuboid(
      this.size.x / 8,
      this.size.y / 3,
      this.size.z / 5
    ).setTranslation(0, 0, -this.size.z / 1.5);
    const handleCollider = this.world.createCollider(
      handleColliderDesc,
      rigidBody
    );
    handleCollider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    window.simObjs.set(rigidBody, this.meshes[0]);
    window.scene.add(this.meshes[0]);

    this.loaded = true;

    this.rigidBody = rigidBody;
    this.colliders = [handleCollider, ...colliders];
  }

  /**
   *
   * @param {T.Vector3} position
   * @param {T.Quaternion} rotation
   */
  grasp(position, rotation) {
    this.destruct();
    // switch to KinematicPositionBased rigid-body so the pose of the block can be set according to the gripper
    this.load("kinematicPositionBased", position, rotation);
    this.grasped = true;
  }

  /**
   *
   * @param {T.Vector3} position
   * @param {T.Quaternion} rotation
   */
  ungrasp(position, rotation) {
    this.destruct();
    this.load("dynamic", position, rotation);
  }

  destruct() {
    this.grasped = false;
    window.scene.remove(this.meshes[0]);
    window.simObjs.delete(this.rigidBody);
    this.world.removeRigidBody(this.rigidBody);
    this.loaded = false;
  }

  /**
   * Detects the grasping interaction between gripper and block. This method needs to be improved.
   * @param {} world
   */
  update(world, gripper) {
    let pos1;
    let pos2;
    if (window.robotName == "sawyer") {
      pos1 = window.robot.links["right_gripper_l_finger_tip"].getWorldPosition(
        new T.Vector3()
      );
      pos2 = window.robot.links["right_gripper_r_finger_tip"].getWorldPosition(
        new T.Vector3()
      );
    } else {
      pos1 = window.robot.links["left_inner_finger_pad"].getWorldPosition(
        new T.Vector3()
      );
      pos2 = window.robot.links["right_inner_finger_pad"].getWorldPosition(
        new T.Vector3()
      );
    }
    const width = pos1.distanceTo(pos2);

    let posi = new T.Vector3();
    posi.copy(gripper.position);
    let ori = new T.Quaternion();
    ori.copy(gripper.quaternion);
    let correctionRot = new T.Quaternion(
      0,
      Math.sin(Math.PI / 4),
      0,
      Math.cos(Math.PI / 4)
    );
    ori.multiply(correctionRot);
    let correctionTrans = new T.Vector3(0, 0, 0);
    if (window.robotName == "sawyer") {
      correctionTrans.z = 0.07;
    }
    correctionTrans.applyQuaternion(ori);
    posi.add(correctionTrans);

    if (!this.grasped) {
      let [left, right] = [false, false];

      if (window.robotName == "sawyer") {
        world.contactsWith(
          window.robotColliders["right_gripper_l_finger_tip"][0],
          (collider) => {
            if (collider === this.colliders[0]) left = true;
          }
        );

        world.contactsWith(
          window.robotColliders["right_gripper_r_finger_tip"][0],
          (collider) => {
            if (collider === this.colliders[0]) right = true;
          }
        );
      } else {
        world.contactsWith(
          window.robotColliders["left_inner_finger_pad"][0],
          (collider) => {
            if (collider === this.colliders[0]) left = true;
          }
        );

        world.contactsWith(
          window.robotColliders["right_inner_finger_pad"][0],
          (collider) => {
            if (collider === this.colliders[0]) right = true;
          }
        );
      }

      if (
        left &&
        right &&
        width < this.size.x / 4 + 0.01 &&
        width > this.size.x / 4
      ) {
        this.grasp(posi, ori);
        window.grasped = true;
      }
    } else {
      this.rigidBody.setNextKinematicTranslation(posi);
      this.rigidBody.setNextKinematicRotation(ori);

      if (width > this.size.x / 4 + 0.01) {
        this.ungrasp(posi, ori);
        window.grasped = false;
      }
    }
  }
}
