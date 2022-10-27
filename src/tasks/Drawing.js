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
    task.points = [];
    task.material = new T.LineBasicMaterial({
      color: options.color ?? "blue",
      linewidth: 5,
    });
    task.line = null;
    task.lineAdded = false;
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
  }

  onStop() {
    this.instructions.hide();
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
    if (this.robotControlled) {
      pose = getCurrEEPose();
    } else {
      pose = this.controller.getPose("right");
    }
    let ori = new T.Euler();
    ori.setFromQuaternion(pose.ori);
    this.objects.marker.set({
      position: pose.posi,
      rotation: ori,
    });
    if (this.robotControlled) {
      this.objects.marker.meshes[0].rotateX(-Math.PI / 2);
      this.objects.marker.meshes[0].translateY(-0.2);
    } else {
      this.objects.marker.meshes[0].translateY(-0.1);
    }
  }

  draw() {
    const state = this.objects.marker.getState()[0];
    let position = state.position;
    const rotation = state.rotation;
    if (
      position.x > 0.85 &&
      position.y > 0.85 &&
      position.y < 1.85 &&
      position.z > -0.7 &&
      position.z < 0.7
    ) {
      position.x = 0.99;
      this.points.push(position);
    }
    if (this.points.length > 2) {
      if (this.lineAdded) {
        window.scene.remove(this.line);
        this.lineAdded = false;
      }
      const geometry = new T.BufferGeometry().setFromPoints(this.points);
      this.line = new T.Line(geometry, this.material);
      window.scene.add(this.line);
      this.lineAdded = true;
    }
  }
}
