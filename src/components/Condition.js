import StateMachine from "javascript-state-machine";
import { DragControl } from "../modules/DragControl";
import Grasping from "../modules/Grasping";

export default class Condition {
  constructor(name, module, utilities, grip = false) {
    this.name = name;
    this.module = module;
    this.grip = grip;
    this.graspingControl = new Grasping(utilities, {
      controlMode: "trigger-toggle",
    });
    this.fpControl = new DragControl(utilities, { controlMode: "grip-toggle" });

    this.isLoaded = false;
  }

  load() {
    const config = {
      init: "IDLE",
      transitions: [],
      methods: {},
    };

    this.module.load(config);
    this.graspingControl.load(config);
    this.fpControl.load(config);

    this.fsm = new StateMachine(config);

    this.module.setFSM(this.fsm);
    this.graspingControl.setFSM(this.fsm);
    this.fpControl.setFSM(this.fsm);

    this.isLoaded = true;
  }

  unload() {
    this.reset();
    this.module.unload();
    this.graspingControl.unload();
    this.fpControl.unload();
    this.fsm = undefined;

    this.isLoaded = false;
  }

  reset() {
    this.module.reset();
    this.graspingControl.reset();
    this.fpControl.reset();
  }

  update(t, info) {
    if (window.firstPerson) {
      this.fpControl.update(t, info);
    } else {
      this.module.update(t, info);
    }

    if (this.grip) {
      this.graspingControl.update(t, info);
    }
  }
}
