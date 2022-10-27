import * as T from "three";
import { loadGLTF } from "../utilities/loaders";
import RAPIER from "@dimforge/rapier3d";
import Controllers from "../components/Controllers";
import SceneObject from "./SceneObject";
import { setPos } from "../utilities/robot";
import { T_ROS_to_THREE } from "../utilities/globals";
import { changeReferenceFrame } from "../utilities/math";

const PATH = "./models/whiteboard.glb";

export default class Whiteboard extends SceneObject {
  constructor(params, options = {}) {
    super("whiteboard", params);
    this.initPosition = options.position ?? new T.Vector3();
    this.initRotation = options.rotation ?? new T.Euler();
    this.initScale = options.scale ?? new T.Vector3(0.125, 0.125, 0.125);
    this.loaded = false;
  }

  static async init(params) {
    const object = new Whiteboard(params);
    await object.fetch();
    return object;
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

  load() {
    // build rigid-body
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(
        this.initPosition.x,
        this.initPosition.y,
        this.initPosition.z
      )
      .setRotation(new T.Quaternion().setFromEuler(this.initRotation))
      .lockTranslations()
      .lockRotations();
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // build colliders
    const colliderDescs = [
      RAPIER.ColliderDesc.cuboid(
        0.125 * this.initScale.x,
        3.9 * this.initScale.y,
        5.5 * this.initScale.z
      ).setTranslation(0, 10.75 * this.initScale.y, 0),
    ];

    const colliders = [];
    for (const colliderDesc of colliderDescs) {
      const collider = this.world.createCollider(colliderDesc, rigidBody);
      collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      colliders.push(collider);
    }

    window.simObjs.set(rigidBody, this.meshes[0]);
    window.scene.add(this.meshes[0]);

    this.rigidBody = rigidBody;
    this.colliders = colliders;

    this.loaded = true;
  }

  destruct() {
    window.scene.remove(this.meshes[0]);
    window.simObjs.delete(this.rigidBody);
    this.world.removeRigidBody(this.rigidBody);

    this.loaded = false;
  }

  /**
   * Fakes collision between robot with pen and whiteboard
   * @param {*} world
   * @param {Controllers} controller
   */
  update(world, controller) {
    let pos = changeReferenceFrame(window.goalEERelThree, T_ROS_to_THREE);
    if (pos.posi.x > -0.5) {
      pos.posi.x = -0.5;
      setPos(pos);
    }
  }
}
