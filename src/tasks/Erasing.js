import * as T from "three";
import Task from "./Task";
import Whiteboard from "../objects/Whiteboard";
import Eraser from "../objects/Eraser";
import { getCurrEEPose } from "../utilities/robot";
import traces from "../utilities/traces";
import { SCRIBBLE } from "../utilities/sounds";

export default class Erasing extends Task {
  static async init(params, condition, options = {}) {
    const task = new Erasing(params, condition, options);
    task.objects = {
      whiteboard: await Whiteboard.init(params),
      eraser: await Eraser.init(params),
    };
    task.debug = options.debug ?? true;
    task.robotControlled = options.robotControlled ?? true;
    task.distFromWhiteboard = options.distFromWhiteboard ?? 0.05;
    task.eraseVibrationStrength = options.eraseVibrationStrength ?? 0;
    task.stopOnCollision = options.stopOnCollision ?? true;
    task.points = [[]];
    task.material = new T.LineBasicMaterial({
      color: "white",
      linewidth: options.lineWidth ?? 500,
    });
    task.traceName = options.trace ?? "";
    task.trace = options.trace ? traces[options.trace] : null;
    task.curveScale = options.curveScale ?? 1;
    task.curve = null;
    task.lines = [null];
    task.lineIndex = 0;
    task.lineAdded = false;
    task.id = new Date().getTime();
    task.buffer = [];
    task.bufferSize = options.bufferSize ?? 500;
    return task;
  }

  constructor(params, condition, options) {
    super("erasing", params, condition, options, [() => {}, () => {}]);
  }

  async onStart() {
    this.instructions = this.ui.createContainer("erasing-instructions", {
      height: 0.4,
      position: new T.Vector3(0, 1.5, -2),
      rotation: new T.Euler(0, -Math.PI / 2, 0, "XYZ"),
      backgroundOpacity: 0,
    });
    this.instructions.appendChild(
      this.ui.createText("Whiteboard Erasing\n", { fontSize: 0.08 })
    );
    this.instructions.appendChild(
      this.ui.createText(
        this.text ??
          "Complete the task by erasing the drawing on the whiteboard.\n\n",
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
    if (this.robotControlled) {
      window.adjustedControl = (goal) => {
        if (this.stopOnCollision) {
          let direction = new T.Vector3(0.15, 0, 0);
          direction.applyQuaternion(goal.ori);
          goal.posi.add(direction);
          if (goal.posi.x > 0.38) {
            goal.posi.x = 0.38;
          }
          direction.multiplyScalar(-1);
          goal.posi.add(direction);
        }
        return goal;
      };
    } else {
      this.controller.get().grip.traverse((child) => {
        if (child instanceof T.Mesh) child.visible = false;
      });
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
    }

    const data = {
      id: this.id,
      debug: this.debug,
      robotControlled: this.robotControlled,
      distFromWhiteboard: this.distFromWhiteboard,
      eraseVibrationStrength: this.eraseVibrationStrength,
      stopOnCollision: this.stopOnCollision,
      lineWidth: this.material.linewidth,
      trace: this.traceName,
      curveScale: this.curveScale,
    };
    /*
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
    */
  }

  onStop() {
    this.instructions.hide();

    for (let line of this.lines) {
      window.scene.remove(line);
    }

    window.adjustedControl = (goal) => {
      return goal;
    };

    this.controller.get().grip.traverse((child) => {
      if (child instanceof T.Mesh) child.visible = true;
    });

    if (this.trace != null) {
      window.scene.remove(this.curve);
    }

    this.updateRequest(true);
    /*
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
    */
  }

  onUpdate(t, info) {
    const whiteboard = this.objects.whiteboard;
    //whiteboard.update(this.world, this.controller);
    this.updateEraser();
    this.erase();
    this.updateRequest();

    // ~ update ui elements ~

    this.instructions?.getObject().lookAt(window.camera.position);

    this.trialCounterText?.set(
      `Trial: ${Number(this.fsm.state) + 1} / ${this.numRounds}`
    );
  }

  updateEraser() {
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
      let correctionTrans = new T.Vector3(0, -0.15, 0);
      correctionTrans.applyQuaternion(ori);
      posi.add(correctionTrans);
    } else {
      pose = this.controller.getPose("right");
      posi.copy(pose.posi);
      ori.copy(pose.ori);
      let correctionRot = new T.Quaternion(
        0,
        Math.sin(Math.PI / 4),
        0,
        Math.cos(Math.PI / 4)
      );
      ori.multiply(correctionRot);
      let correctionTrans = new T.Vector3(0, -0.1, 0);
      correctionTrans.applyQuaternion(ori);
      posi.add(correctionTrans);
      if (this.stopOnCollision && posi.x >= 0.995) {
        posi.x = 0.995;
      }
    }
    let rot = new T.Euler();
    rot.setFromQuaternion(ori);
    this.objects.eraser.set({
      position: posi,
      rotation: rot,
    });
  }

  erase() {
    const state = this.objects.eraser.getState()[0];
    let position = state.position;
    const rotation = state.rotation;
    const target = new T.Vector3(0.99, position.y, position.z);
    const dist = 0.99 - position.x;

    const inBounds =
      target.y > 0.85 && target.y < 1.85 && target.z > -0.7 && target.z < 0.7;

    if (Math.abs(dist) <= this.distFromWhiteboard && inBounds) {
      this.points[this.lineIndex].push(target);
      if (this.eraseVibrationStrength != 0) {
        this.controller
          .get()
          .gamepad?.hapticActuators[0].pulse(this.eraseVibrationStrength, 18);
      }
      //SCRIBBLE.play();
      if (this.lineAdded) {
        window.scene.remove(this.lines[this.lineIndex]);
        this.lineAdded = false;
      }
    } else {
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

  updateRequest(onStop = false) {
    this.buffer.push({
      id: this.id,
      time: new Date().getTime(),
      controller: this.controller.getPose("right"),
      robot: getCurrEEPose(),
      eraser: this.objects.eraser.getState()[0],
    });
    if (this.buffer.length >= this.bufferSize || onStop) {
      /*
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
      */
      this.buffer = [];
    }
  }
}
