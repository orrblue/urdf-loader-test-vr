import StateMachine from "javascript-state-machine";
import { DragControl } from "../modules/DragControl";
import Grasping from "../modules/Grasping";

export default class Condition {
  constructor(name, module, utilities, grip = false) {
    this.name = name;
    this.module = module;
    this.fp = !window.firstPerson;
    if (grip) {
      this.graspingControl = new Grasping(utilities, {
        controlMode: "trigger-toggle",
      });
    } else {
      this.graspingControl = null;
    }
    this.fpControl = new DragControl(utilities, { controlMode: "grip-toggle" });

    this.isLoaded = false;
  }

  load() {
    const config = {
      init: "IDLE",
      transitions: [],
      methods: {},
    };

    this.fpControl.load(config);
    if (this.graspingControl) {
      this.graspingControl.load(config);
    }
    this.module.load(config);

    this.fsm = new StateMachine(config);

    this.module.setFSM(this.fsm);
    if (this.graspingControl) {
      this.graspingControl.setFSM(this.fsm);
    }
    this.fpControl.setFSM(this.fsm);

    this.isLoaded = true;
  }

  unload() {
    this.reset();
    if (this.fp) {
      this.fpControl.unload();
    } else {
      this.module.unload();
    }
    if (this.graspingControl) {
      this.graspingControl.unload();
    }
    this.fsm = undefined;

    this.isLoaded = false;
  }

  reset() {
    this.module.reset();
    if (this.graspingControl) {
      this.graspingControl.reset();
    }
    this.fpControl.reset();
  }

  update(t, info) {
    const config = {
      init: "IDLE",
      transitions: [],
      methods: {},
    };

    if (window.firstPerson) {
      if (!this.fp) {
        this.module.unload();
        this.fpControl.load(config);
      }
      this.fpControl.update(t, info);
    } else {
      if (this.fp) {
        this.fpControl.unload();
        this.module.load(config);
      }
      this.module.update(t, info);
    }

    this.fp = window.firstPerson;

    if (this.graspingControl) {
      this.graspingControl.update(t, info);
    }
  }
}
