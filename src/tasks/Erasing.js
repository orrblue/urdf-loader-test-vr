import * as T from "three";
import Task from "./Task";
import Whiteboard from "../objects/Whiteboard";
import Eraser from "../objects/Eraser";
import { getCurrEEPose } from "../utilities/robot";
import erasePaths from "../utilities/erasePaths";
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
    task.distFromWhiteboard = options.distFromWhiteboard ?? 0.01;
    task.eraseVibrationStrength = options.eraseVibrationStrength ?? 0;
    task.stopOnCollision = options.stopOnCollision ?? true;
    task.material = new T.LineBasicMaterial({
      color: "blue",
      linewidth: options.lineWidth ?? 5,
    });
    const pathName = options.path ?? "line";
    task.pathName = pathName;
    task.points = erasePaths[pathName];
    task.lines = [[]];
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
          for (let y = -0.075; y <= 0.075; y += 0.15) {
            for (let z = -0.025; z <= 0.025; z += 0.05) {
              let direction = new T.Vector3(0.15, y, z);
              direction.applyQuaternion(goal.ori);
              goal.posi.add(direction);
              if (goal.posi.x > 0.4) {
                goal.posi.x = 0.4;
              }
              direction.multiplyScalar(-1);
              goal.posi.add(direction);
            }
          }
        }
        return goal;
      };
    } else {
      this.controller.get().grip.traverse((child) => {
        if (child instanceof T.Mesh) child.visible = false;
      });
    }

    const data = {
      id: this.id,
      debug: this.debug,
      robotControlled: this.robotControlled,
      distFromWhiteboard: this.distFromWhiteboard,
      eraseVibrationStrength: this.eraseVibrationStrength,
      stopOnCollision: this.stopOnCollision,
      lineWidth: this.material.linewidth,
      erasePath: this.pathName,
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
    this.renderLines();
    this.updateEraser();
    this.erase();
    this.updateRequest();

    // ~ update ui elements ~

    this.instructions?.getObject().lookAt(window.camera.position);

    this.trialCounterText?.set(
      `Trial: ${Number(this.fsm.state) + 1} / ${this.numRounds}`
    );
  }

  renderLines() {
    for (let line of this.lines) {
      window.scene.remove(line);
    }
    this.lines = [];
    for (let points of this.points) {
      const geometry = new T.BufferGeometry().setFromPoints(points);
      const line = new T.Line(geometry, this.material);
      window.scene.add(line);
      this.lines.push(line);
    }
  }

  erasePoint(i, j) {
    let points = this.points[i];
    if (j > 1) {
      this.points.push(points.slice(0, j));
    }
    if (j < points.length - 2) {
      this.points.push(points.slice(j + 1));
    }
    this.points.splice(i, 1);
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
      if (this.stopOnCollision) {
        for (let x = -0.075; x <= 0.075; x += 0.15) {
          for (let z = -0.025; z <= 0.025; z += 0.05) {
            let direction = new T.Vector3(x, 0, z);
            direction.applyQuaternion(ori);
            posi.add(direction);
            if (posi.x > 1) {
              posi.x = 1;
            }
            direction.multiplyScalar(-1);
            posi.add(direction);
          }
        }
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

    let nearWhiteboard = true;
    for (let x = -0.075; x <= 0.075; x += 0.15) {
      for (let z = -0.025; z <= 0.025; z += 0.05) {
        let direction = new T.Vector3(x, 0, z);
        direction.applyQuaternion(rotation);
        direction.add(position);
        if (0.99 - direction.x > this.distFromWhiteboard) {
          nearWhiteboard = false;
        }
      }
    }

    if (nearWhiteboard) {
      let i = 0;
      while (i < this.points.length) {
        for (let j = 0; j < this.points[i].length; j++) {
          let erased = false;
          for (let x = -0.05; x <= 0.05; x += 0.025) {
            let direction = new T.Vector3(x, 0, 0);
            direction.applyQuaternion(rotation);
            direction.add(target);
            if (this.points[i][j].distanceTo(direction) < 0.025) {
              erased = true;
              break;
            }
          }
          if (erased) {
            this.erasePoint(i, j);
            i--;
            break;
          }
        }
        i++;
      }
      if (this.eraseVibrationStrength != 0) {
        this.controller
          .get()
          .gamepad?.hapticActuators[0].pulse(this.eraseVibrationStrength, 18);
      }
      //SCRIBBLE.play();
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
