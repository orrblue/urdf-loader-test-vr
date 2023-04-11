import * as T from "three";
import Task from "./Task";
import Whiteboard from "../objects/Whiteboard";
import Marker from "../objects/Marker";
import { getCurrEEPose } from "../utilities/robot";
import traces from "../utilities/traces";
import { SCRIBBLE } from "../utilities/sounds";

export default class Drawing extends Task {
  static async init(params, condition, options = {}) {
    const task = new Drawing(params, condition, options);
    task.objects = {
      whiteboard: await Whiteboard.init(params),
      marker: await Marker.init(params),
    };
    task.debug = options.debug ?? true;
    task.robotControl = options.robotControl ?? true;
    task.setRobot = options.setRobot ?? "";
    task.adjustedControl = options.adjustedControl ?? false;
    task.distFromWhiteboard = options.distFromWhiteboard ?? 0.05;
    task.drawVibrationStrength = options.drawVibrationStrength ?? 0;
    task.rotationBased = options.rotationBased ?? true;
    task.stopOnCollision = options.stopOnCollision ?? false;
    task.pointerSize = options.pointerSize ?? 0;
    task.points = [[]];
    task.material = new T.LineBasicMaterial({
      color: options.color ?? "blue",
      linewidth: options.lineWidth ?? 5,
    });
    task.traceName = options.trace ?? "";
    task.trace = options.trace ? traces[options.trace] : null;
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
    task.id = new Date().getTime();
    task.buffer = [];
    task.bufferSize = options.bufferSize ?? 500;
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
      this.ui.createText("Drawing Task\n", { fontSize: 0.08 })
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

    if (this.setRobot != "") {
      window.setRobot(this.setRobot);
    }

    if (this.robotControl) {
      window.adjustedControl = (goal) => {
        let posi = goal.position.clone();
        let ori = goal.quaternion.clone();

        if (this.adjustedControl) {
          let direction = new T.Vector3(-0.1, 0, 0);
          direction.applyQuaternion(ori);
          posi.add(direction);
        }

        if (this.stopOnCollision) {
          let direction = new T.Vector3(0, 0, 0);
          if (window.robotName == "sawyer") {
            direction.x = 0.2;
          } else {
            direction.x = 0.1;
          }
          direction.applyQuaternion(ori);
          posi.add(direction);
          if (posi.x > 0.38) {
            posi.x = 0.38;
          }
          direction.multiplyScalar(-1);
          posi.add(direction);
        }

        return {
          posi: posi,
          ori: ori,
        };
      };
    } else {
      window.robotObjs.forEach(
        (visualGroup, rigidBody) => (visualGroup.visible = false)
      );
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

    const data = {
      id: this.id,
      debug: this.debug,
      robotControlled: this.robotControl,
      adjustedControl: this.adjustedControl,
      distFromWhiteboard: this.distFromWhiteboard,
      drawVibrationStrength: this.drawVibrationStrength,
      rotationBased: this.rotationBased,
      stopOnCollision: this.stopOnCollision,
      pointerSize: this.pointerSize,
      color: this.material.color,
      lineWidth: this.material.linewidth,
      trace: this.traceName,
      curveScale: this.curveScale,
      distFromCurve: this.distFromCurve,
    };
    fetch(
      "https://script.google.com/macros/s/AKfycbxWv-joKoA71hLWZyyCBUAGRf75LQ26yq_3sCi7Cfs_kqHoTZIzbvdNxpNyrvobNYCVkg/exec",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify(data),
      }
    );
  }

  onStop() {
    this.instructions.hide();

    for (let line of this.lines) {
      window.scene.remove(line);
    }

    window.adjustedControl = (goal) => {
      return {
        posi: goal.position.clone(),
        ori: goal.quaternion.clone(),
      };
    };

    window.robotObjs.forEach(
      (visualGroup, rigidBody) => (visualGroup.visible = true)
    );

    if (this.pointerSize != 0) {
      window.scene.remove(this.pointer);
    }

    if (this.trace != null) {
      window.scene.remove(this.curve);
      window.scene.remove(this.startMesh);
      window.scene.remove(this.endMesh);
    }

    this.updateRequest(true);
    const data = {
      id: this.id,
      time: new Date().getTime() - this.id,
      points: this.points,
    };
    fetch(
      "https://script.google.com/macros/s/AKfycbwYXm4Hl7gheI0AVOveRwR8_5a9wx8h8e9_sdZgUFJayOGQh5-B-CuL3mD9dSVw5sDkFQ/exec",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify(data),
      }
    );
  }

  onUpdate(t, info) {
    const whiteboard = this.objects.whiteboard;
    //whiteboard.update(this.world, this.controller);
    this.updateMarker();
    this.draw();
    this.updateRequest();

    // ~ update ui elements ~

    this.instructions?.getObject().lookAt(window.camera.position);

    this.trialCounterText?.set(
      `Trial: ${Number(this.fsm.state) + 1} / ${this.numRounds}`
    );
  }

  updateMarker() {
    let posi = new T.Vector3();
    let ori = new T.Quaternion();
    if (this.robotControl) {
      let pose = getCurrEEPose();
      posi.copy(pose.posi);
      ori.copy(pose.ori);
      let correctionRot = new T.Quaternion(
        Math.sin(-Math.PI / 4),
        0,
        0,
        Math.cos(-Math.PI / 4)
      );
      ori.multiply(correctionRot);
      let correctionTrans = new T.Vector3(0, 0, 0);
      if (window.robotName == "sawyer") {
        correctionTrans.y = -0.2;
      } else {
        correctionTrans.y = -0.05;
      }
      correctionTrans.applyQuaternion(ori);
      posi.add(correctionTrans);
    } else {
      posi.copy(window.goalEERelThree.getWorldPosition(new T.Vector3()));
      ori.copy(window.goalEERelThree.getWorldQuaternion(new T.Quaternion()));
      if (this.adjustedControl) {
        let correctionRot = new T.Quaternion(
          0,
          0,
          Math.sin(Math.PI / 4),
          Math.cos(Math.PI / 4)
        );
        ori.multiply(correctionRot);
      } else {
        let correctionRot = new T.Quaternion(
          0,
          0,
          Math.sin(Math.PI / 4),
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
      this.points[this.lineIndex].push(target);
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
      //SCRIBBLE.play();
      if (this.lineAdded) {
        window.scene.remove(this.lines[this.lineIndex]);
        this.lineAdded = false;
      }
    } else {
      if (this.started && this.ended) {
        this.fsm.next();
      }
      if (this.lines[this.lineIndex] != null) {
        this.points.push([]);
        this.lines.push(null);
        this.lineIndex++;
      } else {
        this.points[this.lineIndex] = [];
      }
    }

    if (this.points[this.lineIndex].length > 2) {
      const geometry = new T.BufferGeometry().setFromPoints(
        this.points[this.lineIndex]
      );
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

  updateRequest(onStop = false) {
    this.buffer.push({
      id: this.id,
      time: new Date().getTime(),
      controller: this.controller.getPose("right"),
      robot: getCurrEEPose(),
      marker: this.objects.marker.getState()[0],
    });
    if (this.buffer.length >= this.bufferSize || onStop) {
      fetch(
        "https://script.google.com/macros/s/AKfycbyfQ9I8vcTCv5opgQRdnkjdVNrrBC9xqvqkHk6uvU89Wm7NfwPYmjQSM2Kpb_lbSThC/exec",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          mode: "no-cors",
          body: JSON.stringify(this.buffer),
        }
      );
      this.buffer = [];
    }
  }
}
