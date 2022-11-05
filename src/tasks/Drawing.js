import * as T from "three";
import Task from "./Task";
import Whiteboard from "../objects/Whiteboard";
import Marker from "../objects/Marker";
import { getCurrEEPose } from "../utilities/robot";

export default class Drawing extends Task {
  static async init(params, condition, options = {}) {
    const task = new Drawing(params, condition, options);
    task.objects = {
      whiteboard: await Whiteboard.init(params),
      marker: await Marker.init(params),
    };
    task.robotControlled = options.robotControlled ?? true;
    task.adjustedControl = options.adjustedControl ?? false;
    task.distFromWhiteboard = options.distFromWhiteboard ?? 0.05;
    task.drawVibrationStrength = options.drawVibrationStrength ?? 0;
    task.rotationBased = options.rotationBased ?? true;
    task.stopOnCollision = options.stopOnCollision ?? false;
    task.pointerSize = options.pointerSize ?? 0;
    task.points = [];
    task.material = new T.LineBasicMaterial({
      color: options.color ?? "blue",
      linewidth: options.lineWidth ?? 5,
    });
    task.trace = options.trace ?? null;
    task.traceStart = new T.Vector3();
    task.traceEnd = new T.Vector3();
    task.curveScale = options.curveScale ?? 1;
    task.distFromCurve = options.distFromCurve ?? 0.05;
    task.started = false;
    task.ended = false;
    task.curve = null;
    task.startMesh = null;
    task.endMesh = null;
    task.lines = [null];
    task.lineIndex = 0;
    task.lineAdded = false;
    task.pointer = null;
    return task;
  }

  constructor(params, condition, options) {
    super("drawing", params, condition, options, [() => {}, () => {}]);
  }

  async onStart() {
    this.instructions = this.ui.createContainer("drawing-instructions", {
      height: 0.4,
      position: new T.Vector3(0, 1.5, -2),
      rotation: new T.Euler(0, -Math.PI / 2, 0, "XYZ"),
      backgroundOpacity: 0,
    });
    this.instructions.appendChild(
      this.ui.createText("Whiteboard Drawing\n", { fontSize: 0.08 })
    );
    this.instructions.appendChild(
      this.ui.createText(
        this.text ??
          "Complete the task by drawing over the outline on the whiteboard.\n\n",
        { fontSize: 0.04 }
      )
    );

    this.trialCounterText = this.ui.createText("Trial: - / -");
    this.instructions.appendChild(this.trialCounterText);

    this.instructions.show();
    this.objects.whiteboard.set({
      position: new T.Vector3(1, 0, 0),
      rotation: new T.Euler(0, Math.PI, 0, "XYZ"),
    });
    if (!this.robotControlled) {
      this.controller.get().grip.traverse((child) => {
        if (child instanceof T.Mesh) child.visible = false;
      });
    }

    if (this.pointerSize != 0) {
      const geom = new T.SphereGeometry(this.pointerSize);
      const mat = new T.MeshBasicMaterial({ color: "red" });
      this.pointer = new T.Mesh(geom, mat);
      window.scene.add(this.pointer);
    }

    if (this.trace != null) {
      const geom = new T.PlaneGeometry(
        1.4 * this.curveScale,
        1 * this.curveScale
      );
      const mat = new T.MeshStandardMaterial({ map: this.trace.texture });
      this.curve = new T.Mesh(geom, mat);
      this.curve.position.set(0.995, 1.35, 0);
      this.curve.rotateY(-Math.PI / 2);
      window.scene.add(this.curve);
      this.traceStart.set(
        this.trace.start.x,
        1.35 + (this.trace.start.y - 1.35) * this.curveScale,
        this.trace.start.z * this.curveScale
      );
      this.traceEnd.set(
        this.trace.end.x,
        1.35 + (this.trace.end.y - 1.35) * this.curveScale,
        this.trace.end.z * this.curveScale
      );
      const curveGeom = new T.SphereGeometry(0.01);
      const curveMat = new T.MeshBasicMaterial({ color: "green" });
      this.startMesh = new T.Mesh(curveGeom, curveMat);
      this.startMesh.position.copy(this.traceStart);
      window.scene.add(this.startMesh);
      this.endMesh = new T.Mesh(curveGeom, curveMat);
      this.endMesh.position.copy(this.traceEnd);
      window.scene.add(this.endMesh);
    }
  }

  onStop() {
    this.instructions.hide();

    for (let line of this.lines) {
      window.scene.remove(line);
    }

    this.controller.get().grip.traverse((child) => {
      if (child instanceof T.Mesh) child.visible = true;
    });

    if (this.pointerSize != 0) {
      window.scene.remove(this.pointer);
    }

    if (this.trace != null) {
      window.scene.remove(this.curve);
      window.scene.remove(this.startMesh);
      window.scene.remove(this.endMesh);
    }
  }

  onUpdate(t, info) {
    const whiteboard = this.objects.whiteboard;
    //whiteboard.update(this.world, this.controller);
    this.updateMarker();
    this.draw();

    // ~ update ui elements ~

    this.instructions?.getObject().lookAt(window.camera.position);

    this.trialCounterText?.set(
      `Trial: ${Number(this.fsm.state) + 1} / ${this.numRounds}`
    );
  }

  updateMarker() {
    let pose;
    let posi = new T.Vector3();
    let ori = new T.Quaternion();
    if (this.robotControlled) {
      pose = getCurrEEPose();
      posi.copy(pose.posi);
      ori.copy(pose.ori);
      let correctionRot = new T.Quaternion(
        Math.sin(-Math.PI / 4),
        0,
        0,
        Math.cos(-Math.PI / 4)
      );
      ori.multiply(correctionRot);
      let correctionTrans = new T.Vector3(0, -0.2, 0);
      correctionTrans.applyQuaternion(ori);
      posi.add(correctionTrans);
    } else {
      pose = this.controller.getPose("right");
      posi.copy(pose.posi);
      ori.copy(pose.ori);
      if (this.adjustedControl) {
        let correctionRot = new T.Quaternion(
          Math.sin(Math.PI / 4),
          0,
          0,
          Math.cos(Math.PI / 4)
        );
        ori.multiply(correctionRot);
      }
      let correctionTrans = new T.Vector3(0, -0.1, 0);
      correctionTrans.applyQuaternion(ori);
      posi.add(correctionTrans);
      if (this.stopOnCollision && posi.x >= 0.995) {
        posi.x = 0.995;
      }
    }
    let rot = new T.Euler();
    rot.setFromQuaternion(ori);
    this.objects.marker.set({
      position: posi,
      rotation: rot,
    });
  }

  draw() {
    const state = this.objects.marker.getState()[0];
    let position = state.position;
    const rotation = state.rotation;
    let target = null;
    let dist = 0;

    if (this.rotationBased) {
      const calculation = this.calculatePointer(position, rotation);
      target = calculation.point;
      dist = calculation.dist;
    } else {
      target = new T.Vector3(0.99, position.y, position.z);
      dist = 0.99 - position.x;
    }

    const inBounds =
      target.y > 0.85 && target.y < 1.85 && target.z > -0.7 && target.z < 0.7;
    if (this.pointerSize != 0) {
      if (inBounds && dist >= 0) {
        this.pointer.position.copy(target);
      } else {
        this.pointer.position.set(0, 0, 0);
      }
    }

    if (Math.abs(dist) <= this.distFromWhiteboard && inBounds) {
      this.points.push(target);
      if (this.trace != null) {
        if (this.traceStart.distanceTo(target) <= this.distFromCurve) {
          this.started = true;
        }
        if (this.traceEnd.distanceTo(target) <= this.distFromCurve) {
          this.ended = true;
        }
      }
      if (this.drawVibrationStrength != 0) {
        this.controller
          .get()
          .gamepad?.hapticActuators[0].pulse(this.drawVibrationStrength, 18);
      }
      if (this.lineAdded) {
        window.scene.remove(this.lines[this.lineIndex]);
        this.lineAdded = false;
      }
    } else {
      this.points = [];
      if (this.lines[this.lineIndex] != null) {
        this.lines.push(null);
        this.lineIndex++;
      }
      if (this.started && this.ended) {
        this.fsm.next();
      }
    }

    if (this.points.length > 2) {
      const geometry = new T.BufferGeometry().setFromPoints(this.points);
      this.lines[this.lineIndex] = new T.Line(geometry, this.material);
      window.scene.add(this.lines[this.lineIndex]);
      this.lineAdded = true;
    }
  }

  calculatePointer(position, rotation) {
    let direction = new T.Vector3(0, -1, 0);
    direction.applyQuaternion(rotation);
    const dist = (0.99 - position.x) / direction.x;
    direction.multiplyScalar(dist);
    direction.add(position);
    return { point: direction, dist: dist };
  }
}
