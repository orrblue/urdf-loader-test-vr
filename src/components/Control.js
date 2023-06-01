/**
 * @author William Cong
 */

import * as T from "three";
import { getCurrEEPose, updateRobot } from "../utilities/robot";
import StateMachine from "javascript-state-machine";
import TeleportVR from "../utilities/teleportvr";
import Controllers from "./Controllers";
import Condition from "./Condition";

// tasks
import DragControlTutorial from "../tasks/tutorials/DragControlTutorial";
import RemoteControlTutorial from "../tasks/tutorials/RemoteControlTutorial";
import GraspingTutorial from "../tasks/tutorials/GraspingTutorial";
import PickAndDrop from "../tasks/PickAndDrop";
import Stack from "../tasks/Stack";
import Drawing from "../tasks/Drawing";
import Erasing from "../tasks/Erasing";
import Pouring from "../tasks/Pouring";
import End from "../tasks/End";

// modules
import { DragControl } from "../modules/DragControl";
import { RemoteControl } from "../modules/RemoteControl";
import { RedirectedControl } from "../modules/RedirectedControl";
import { OffsetControl } from "../modules/OffsetControl";
import { ClutchedOffsetControl } from "../modules/ClutchedOffsetControl";
import Grasping from "../modules/Grasping";

// initial position of user after entering VR
const INIT_POSITION = new T.Vector3(0.25, 0, 0.5);

export default class Control {
  static async init(params) {
    const control = new Control();

    control.camera = params.camera;
    control.renderer = params.renderer;
    control.data = params.data;
    control.ui = params.ui;
    control.world = params.world;
    control.ground = params.ground;

    const pose = getCurrEEPose();
    window.initEEAbsThree.position.copy(pose.posi);

    control.resettingTask = false;
    control.switchingTask = false;

    // whether or not teleportation is enabled,
    // teleportvr is still initialized here because it is used to set the initial position of the user
    control.teleportvr = new TeleportVR(window.scene, control.camera);
    window.teleportvr = control.teleportvr;
    control.teleportvr.rotationScheme = "ee";
    control.teleportvr.enabled = true;
    control.renderer.xr.addEventListener("sessionstart", () =>
      control.teleportvr.set(INIT_POSITION)
    );

    control.controller = new Controllers(control.renderer, control.teleportvr);

    const utilities = {
      data: control.data,
      ui: control.ui,
      world: control.world,
      controller: control.controller,
      camera: control.camera,
      ground: control.ground,
      onComplete: () => control.fsm.next(),
    };

    control.tasks = [
      await RemoteControlTutorial.init(
        utilities,
        new Condition(
          "remote-control-only",
          new RemoteControl(utilities, { controlMode: "grip-toggle" }),
          utilities
        )
      ),
      await Drawing.init(
        utilities,
        new Condition(
          "remote-control-only",
          new RemoteControl(utilities, { controlMode: "grip-toggle" }),
          utilities
        ),
        {
          trace: "ros",
          text: "Drawing Task.\n\n",
        }
      ),
      await Erasing.init(
        utilities,
        new Condition(
          "remote-control-only",
          new RemoteControl(utilities, { controlMode: "grip-toggle" }),
          utilities
        ),
        {
          robot: "sawyer",
          text: "Erasing Task.\n\n",
        }
      ),
      await GraspingTutorial.init(
        utilities,
        new Condition(
          "remote-control-only",
          new RemoteControl(utilities, { controlMode: "grip-toggle" }),
          utilities,
          true
        ),
        {
          robot: "sawyer",
        }
      ),
      await Pouring.init(
        utilities,
        new Condition(
          "remote-control-only",
          new RemoteControl(utilities, { controlMode: "grip-toggle" }),
          utilities,
          true
        ),
        {
          firstPerson: true,
          text: "Pouring Task.\n\n",
        }
      ),
      await Drawing.init(
        utilities,
        new Condition(
          "remote-control-only",
          new RemoteControl(utilities, { controlMode: "grip-toggle" }),
          utilities
        ),
        {
          robot: "mobileSpotArm",
          trace: "ros",
          text: "Mobile Spot Arm Demo.\n\n",
        }
      ),
      await Erasing.init(
        utilities,
        new Condition(
          "redirected-control-only",
          new RedirectedControl(utilities, { controlMode: "grip-toggle" }),
          utilities
        ),
        {
          robot: "sawyer",
          text: "Redirected Control Demo.\n\n",
        }
      ),
      await End.init(
        utilities,
        new Condition(
          "redirected-control-only",
          new RemoteControl(utilities, { controlMode: "grip-toggle" }),
          utilities
        )
      ),
    ];

    control.fsm = new StateMachine({
      init: "IDLE",
      transitions: [
        {
          name: "start",
          from: "IDLE",
          to: "0",
        },
        {
          name: "next",
          from: "*",
          to: function () {
            return Number(this.state) === control.tasks.length
              ? "IDLE"
              : `${Number(this.state) + 1}`;
          },
        },
        {
          name: "previous",
          from: "*",
          to: function () {
            return Number(this.state) === 0
              ? "IDLE"
              : `${Number(this.state) - 1}`;
          },
        },
        {
          name: "stop",
          from: "*",
          to: "IDLE",
        },
      ],
      methods: {
        onStart: () => {
          control.tasks[0].start();
        },
        onNext: (state) => {
          if (state.to === "IDLE") {
            // refreshes the page (i.e. kicks the user out of VR) once all tasks are completed
            window.location.reload();
          } else {
            // starts the next task
            control.tasks[Number(state.to)].start();
          }
        },
      },
    });

    control.renderer.xr.addEventListener("sessionstart", async () => {
      await control.data.initSession();
      control.fsm.start();
    });

    return control;
  }

  update(t) {
    let left_gp = this.controller.get("left").gamepad;
    let right_gp = this.controller.get("right").gamepad;
    
    // check if controllers are connected (rather than hand detection controllers)
    if ( !left_gp || !right_gp || left_gp.buttons.length < 2 || right_gp.buttons.length < 2) {
      //console.log("please reconnect controllers rather than using hand recognition");
      return;
    }

    if (window.firstPerson && !window.fpLockedCamera) {
      window.robotGroup.position.x = window.camera.position.x;
      const direction = new T.Vector3(0, 0, 1).applyQuaternion(
        window.camera.quaternion
      );
      window.robotGroup.rotation.y =
        Math.atan2(-direction.z, direction.x) + Math.PI;
      window.robotGroup.position.z = window.camera.position.z;
      window.robotGroup.translateX(-window.fpCamOffset.x);
    } else {
      if (left_gp) {
        let direction = new T.Vector3(
          left_gp.axes[3],
          0,
          -left_gp.axes[2]
        ).normalize();
        const camDirection = new T.Vector3(0, 0, 1).applyQuaternion(
          window.camera.quaternion
        );
        const yRot = Math.atan2(-camDirection.z, camDirection.x);
        direction.applyEuler(new T.Euler(0, yRot, 0));
        window.robotGroup.position.x += (direction.x * window.deltaTime) / 5000;
        window.robotGroup.position.z += (direction.z * window.deltaTime) / 5000;
      }
      if (right_gp) {
        window.robotGroup.rotateY(
          (window.fpDeltaOri = (-right_gp.axes[2] * window.deltaTime) / 2500)
        );
      }
    }

    if (left_gp) {
      if (left_gp.buttons[4].pressed) {
        this.resettingTask = true;
      } else if (this.resettingTask) {
        this.resettingTask = false;
        this.tasks[Number(this.fsm.state)].fsm.reset();
      }

      if (left_gp.buttons[5].pressed) {
        this.switchingTask = true;
      } else if (this.switchingTask) {
        this.switchingTask = false;
        this.tasks[Number(this.fsm.state)].fsm.next();
      }
    }

    const state = {
      ctrlPose: this.controller.getPose(),
      currEEAbsThree: getCurrEEPose(),
      prevCtrlPose: this.prevCtrlPose,
    };

    // calls the update function of the current task
    // which is determined by the state of the finite state machine
    if (this.fsm.state !== "IDLE") {
      const task = this.tasks[Number(this.fsm.state)];
      task.update(Date.now(), state);
      task.log(Date.now());
    }

    this.controller.update();
    updateRobot();

    this.prevCtrlPose = { ...state.ctrlPose };
  }
}
