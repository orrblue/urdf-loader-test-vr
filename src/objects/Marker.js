import * as T from "three";
import { loadGLTF } from "../utilities/loaders";
import RAPIER from "@dimforge/rapier3d";
import SceneObject from "./SceneObject";

const PATH = "./models/marker/scene.gltf";

export default class Marker extends SceneObject {
  constructor(params, options = {}) {
    super("marker", params);
    this.initPosition = options.position ?? new T.Vector3();
    this.initRotation = options.rotation ?? new T.Euler();
    this.initScale = options.scale ?? new T.Vector3(0.02, 0.02, 0.02);
    this.loaded = false;
  }

  static async init(params) {
    const object = new Marker(params);
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
    const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(
        this.initPosition.x,
        this.initPosition.y,
        this.initPosition.z
      )
      .setRotation(new T.Quaternion().setFromEuler(this.initRotation));
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // build colliders
    const colliderDescs = [
      RAPIER.ColliderDesc.cylinder(
        3.85 * this.initScale.y,
        0.25 * this.initScale.x
      ).setTranslation(0, -2.65 * this.initScale.y, 0),
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
}
