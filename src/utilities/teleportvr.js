/**
 * @license
 * TeleportVR library and demos
 * Copyright 2018-2021 Sean Bradley https://sbcode.net
 * https://github.com/Sean-Bradley/TeleportVR/blob/master/LICENSE
 */
import * as THREE from "three";

export default class TeleportVR {
  constructor(scene, camera) {
    this.controlScheme = "hold";
    this.rotationScheme = "ee";
    this.fpClipDist = 1;
    this.enabled = false;
    this.settingTeleport = false;
    this.settingFPCameraLock = false;
    this._group = new THREE.Group();
    this._target = new THREE.Group();
    this._curve = new THREE.Mesh();
    this._maxDistance = 10;
    this._visible = false;
    this._activeController = new THREE.Object3D();
    this._activeControllerKey = "";
    this._controllers = {};
    this._gamePads = {};
    this._raycaster = new THREE.Raycaster();
    this._group.add(camera);
    scene.add(this._group);
    this._group.add(this._target);
    this._vectorArray = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 3, -1),
      new THREE.Vector3(2, 0, -2)
    );
    this._mesh = new THREE.Mesh(
      new THREE.CylinderBufferGeometry(1, 1, 0.01, 8),
      new THREE.MeshBasicMaterial({
        color: 0x0044ff,
        wireframe: true,
        opacity: 0.5,
        transparent: true,
      })
    );
    this._mesh.name = "helperTarget";
    this._target.add(this._mesh);
    const _mesh2 = new THREE.Mesh(
      new THREE.BoxBufferGeometry(0.03, 0.03, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: false,
      })
    );
    _mesh2.translateZ(-0.5);
    _mesh2.name = "helperDirection";
    this._target.add(_mesh2);
    this._target.visible = false;
    const _geometry = new THREE.TubeGeometry(this._vectorArray, 32, 1, 1, true);
    this._curve = new THREE.Mesh(
      _geometry,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: false,
        opacity: 0.05,
        transparent: true,
      })
    );
    this._curve.visible = false;
    this._group.add(this._curve);
    const direction = new THREE.Vector3(0, -1, 0);
    this._raycaster.ray.direction.copy(direction);
  }
  add(id, controller) {
    controller.grip.name = "teleportVRController_" + id.toString();
    this._group.add(controller.grip);
    this._group.add(controller.controller);
    this._controllers[id] = controller.grip;
    this._gamePads[id] = controller.gamepad;
    //console.log("gamepads length = " + Object.keys(this._gamePads).length)
  }
  setFSM(fsm) {
    this.fsm = fsm;
  }
  get target() {
    return this._target;
  }
  set target(value) {
    this._target = value;
  }
  get curve() {
    return this._curve;
  }
  set curve(value) {
    this._curve = value;
  }
  useDefaultTargetHelper(use) {
    this._target.getObjectByName("helperTarget").visible = use;
  }
  useDefaultDirectionHelper(use) {
    this._target.getObjectByName("helperDirection").visible = use;
  }
  setMaxDistance(val) {
    this._maxDistance = val;
  }
  teleport() {
    this._visible = false;
    this._target.visible = false;
    this._curve.visible = false;
    const newPos = this._target.getWorldPosition(new THREE.Vector3());
    const newOri = this._target.getWorldQuaternion(new THREE.Quaternion());
    console.log();
    if (
      !window.firstPerson &&
      newPos.distanceTo(window.robotGroup.position) < this.fpClipDist
    ) {
      this._group.position.copy(window.robotGroup.position);
      const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(
        window.robotGroup.quaternion
      );
      this._group.rotation.y = Math.atan2(-direction.z, direction.x);
      window.firstPerson = true;
      window.setMobileIK(false);
    } else {
      window.firstPerson = false;
      window.setMobileIK(true);
      const yPos = this._group.position.y;
      this.setCamPos(newPos);
      this._group.position.y = yPos;
      newOri.multiply(
        window.camera.quaternion
          .clone()
          .multiply(this._group.quaternion.clone().invert())
          .invert()
      );
      const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(newOri);
      this._group.rotation.y =
        Math.atan2(-direction.z, direction.x) + Math.PI / 2;
    }
  }
  set(pos) {
    this._group.position.copy(pos);
  }

  setCamPos(pos) {
    this.set(pos.sub(window.camera.position.clone().sub(this._group.position)));
  }

  controlStart(gp) {
    if (gp.buttons.length < 2) {
      console.log("please reconnect controllers rather than using hand recognition")
      return false;
    }
    if (gp.buttons[5].pressed) {
      this.settingFPCameraLock = true;
    }

    if (this.controlScheme == "hold") {
      if (gp.buttons[4].pressed) {
        this.settingTeleport = true;
      }
      return gp.buttons[4].pressed;
    } else {
      return gp.buttons[4].touched && !gp.buttons[4].pressed;
    }
  }

  controlEnd(gp) {
    if (this.settingFPCameraLock && !gp.buttons[5].pressed) {
      this.settingFPCameraLock = false;
      window.fpLockedCamera = !window.fpLockedCamera;
    }

    if (this.controlScheme == "hold") {
      if (this.settingTeleport && !gp.buttons[4].pressed) {
        this.settingTeleport = false;
        return true;
      }
      return false;
    } else {
      return gp.buttons[4].pressed;
    }
  }

  update(elevationsMeshList) {
    if (window.firstPerson) {
      if (window.fpLockedCamera) {
        let offset = new THREE.Vector3(window.fpCamOffset.x, 0, 0);
        offset.applyQuaternion(window.robotGroup.quaternion);
        this.setCamPos(
          new THREE.Vector3(
            window.robotGroup.position.x,
            window.fpCamOffset.y,
            window.robotGroup.position.z
          ).add(offset)
        );
      } else {
        this.setCamPos(
          new THREE.Vector3(
            window.camera.position.x,
            window.fpCamOffset.y,
            window.camera.position.z
          )
        );
      }
    }

    if (
      (this.fsm && !this.fsm.is("IDLE")) ||
      !this.enabled ||
      !this._controllers[0] ||
      !this._controllers[1]
    ) {
      return;
    }

    if (Object.keys(this._gamePads).length > 1) {
      const key = 1;
      const gp = this._gamePads[key];
      
      // check if controllers are connected (rather than hand detection controllers)
      if ( !gp || gp.buttons.length < 2) {
        //console.log("please reconnect controllers rather than using hand recognition");
        return;
      }

      if (this.controlStart(gp)) {
        //console.log("hapticActuators = " + gp.hapticActuators)
        //console.log(gp.axes[0] + " " + gp.axes[1] + " " + gp.axes[2] + " " + gp.axes[3])
        this._activeController = this._controllers[key];
        this._activeControllerKey = key;
        this._visible = true;
        if (this.rotationScheme == "ee") {
          let goal = window.goalEERelThree
            .getWorldPosition(new THREE.Vector3())
            .clone();
          goal.y = 0;
          this._target.lookAt(goal);
          this._target.rotateY(Math.PI);
        } else if (
          this.rotationScheme == "joystick" &&
          Math.abs(gp.axes[2]) + Math.abs(gp.axes[3]) > 0.25
        ) {
          this._target.rotation.y = Math.atan2(-gp.axes[2], -gp.axes[3]); //angle degrees
        }
        this._target.visible = true;
        this._curve.visible = true;
      } else {
        if (this.controlEnd(gp) && this._activeControllerKey === key) {
          this._activeControllerKey = "";
          this._target.position.y = -this._target.getWorldPosition(
            new THREE.Vector3()
          ).y;
          this.teleport();
          this._target.rotation.y = 0;
        } else if (this._activeControllerKey === key) {
          this._activeControllerKey = "";
          this._visible = false;
          this._target.visible = false;
          this._curve.visible = false;
          this._target.rotation.y = 0;
        }
      }
    }
    if (this._visible) {
      const v = new THREE.Vector3(0, -1, 0);
      v.applyQuaternion(this._activeController.quaternion);
      this._target.position.set(
        v.x * this._maxDistance,
        0,
        v.z * this._maxDistance
      );
      if (elevationsMeshList) {
        this._target.getWorldPosition(this._raycaster.ray.origin);
        this._raycaster.ray.origin.y += 10;
        var intersects = this._raycaster.intersectObjects(elevationsMeshList);
        if (intersects.length > 0) {
          this._target.position.y =
            intersects[0].point.y - this._group.position.y;
        }
      }
      this._target.position.y = -this._target.getWorldPosition(
        new THREE.Vector3()
      ).y;
      const absPos = this._target.getWorldPosition(new THREE.Vector3());
      if (
        !window.firstPerson &&
        absPos.distanceTo(window.robotGroup.position) < this.fpClipDist
      ) {
        this._mesh.material.color.setHex(0xffff44);
      } else {
        this._mesh.material.color.setHex(0x0044ff);
      }
      this._vectorArray.v0.copy(this._target.position);
      this._vectorArray.v2.copy(this._activeController.position);
      var midPoint = new THREE.Object3D();
      midPoint.position.copy(this._vectorArray.v2);
      midPoint.quaternion.copy(this._activeController.quaternion);
      midPoint.rotateX(Math.PI / 2);
      midPoint.translateY(
        -this._target.position.distanceTo(this._activeController.position) / 2
      );
      this._vectorArray.v1.copy(midPoint.position);
      const t = new THREE.TubeBufferGeometry(
        this._vectorArray,
        9,
        0.1,
        5,
        false
      );
      this._curve.geometry.copy(t);
    }
  }
}
