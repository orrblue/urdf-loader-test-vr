/**
 * @author William Cong
 */

import * as T from "three";
import {
  getCurrEEPose,
  updateTargetCursor,
  updateRobot,
} from "../utilities/robot";
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

    // initial end effector pose
    window.initEEAbsThree = getCurrEEPose();
    window.goalEERelThree = {
      posi: new T.Vector3(),
      ori: new T.Quaternion().identity(),
    };
    window.adjustedControl = (goal) => {
      return goal;
    };

    // target cursor
    const targetCursor = new T.Mesh(
      new T.SphereGeometry(0.015, 32, 32),
      new T.MeshBasicMaterial({ color: 0xffffff })
    );
    targetCursor.renderOrder = Infinity;
    targetCursor.material.depthTest = false;
    targetCursor.material.depthWrite = false;
    window.scene.add(targetCursor);
    window.targetCursor = targetCursor;
    updateTargetCursor();

    // whether or not teleportation is enabled,
    // teleportvr is still initialized here because it is used to set the initial position of the user
    control.teleportvr = new TeleportVR(window.scene, control.camera);
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
        new Condition("redirected-control-only", [
          new ClutchedOffsetControl(utilities, { controlMode: "grip-toggle" }),
        ])
      ),
      await Drawing.init(
        utilities,
        new Condition("redirected-control-only", [
          new ClutchedOffsetControl(utilities, { controlMode: "grip-toggle" }),
        ]),
        {
          setRobot: "sawyer",
          trace: "ros",
          text: "Sawyer Drawing.\n\n",
        }
      ),
      /*
      await Drawing.init(
        utilities,
        new Condition("redirected-control-only", [
          new ClutchedOffsetControl(utilities, { controlMode: "grip-toggle" }),
        ]),
        {
          setRobot: "ur5",
          trace: "ros",
          text: "ur5 drawing.\n\n",
        }
      ),
      */
      await Erasing.init(
        utilities,
        new Condition("redirected-control-only", [
          new ClutchedOffsetControl(utilities, { controlMode: "grip-toggle" }),
        ]),
        {
          setRobot: "sawyer",
          text: "Sawyer Erasing.\n\n",
        }
      ),
      /*
      await Erasing.init(
        utilities,
        new Condition("redirected-control-only", [
          new ClutchedOffsetControl(utilities, { controlMode: "grip-toggle" }),
        ]),
        {
          setRobot: "ur5",
          text: "ur5 erasing.\n\n",
        }
      ),
      */
      await Drawing.init(
        utilities,
        new Condition("redirected-control-only", [
          new ClutchedOffsetControl(utilities, {
            controlMode: "grip-toggle",
            showOffsetIndicator: false,
          }),
        ]),
        {
          robotControl: false,
          rotationBased: true,
          trace: "lab",
          curveScale: 0.75,
          pointerSize: 0.001,
          distFromWhiteboard: 0.025,
          text: "Hand Drawing.\n\n",
        }
      ),
      await Erasing.init(
        utilities,
        new Condition("redirected-control-only", [
          new ClutchedOffsetControl(utilities, {
            controlMode: "grip-toggle",
            showOffsetIndicator: false,
          }),
        ]),
        {
          robotControl: false,
          text: "Hand Erasing.\n\n",
        }
      ),
      await GraspingTutorial.init(
        utilities,
        new Condition("redirected-control-only", [
          new RedirectedControl(utilities, { controlMode: "grip-toggle" }),
          new Grasping(utilities, { controlMode: "trigger-toggle" }),
        ])
      ),
      await Pouring.init(
        utilities,
        new Condition("redirected-control-only", [
          new RedirectedControl(utilities, { controlMode: "grip-toggle" }),
        ]),
        {
          text: "Pouring Task.\n\n",
        }
      ),
      await End.init(
        utilities,
        new Condition("redirected-control-only", [
          new RedirectedControl(utilities, { controlMode: "grip-toggle" }),
        ])
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

    // use the trigger on the left controller to reset the current trial
    control.controller.controller[0].controller.addEventListener(
      "select",
      () => {
        control.tasks[Number(control.fsm.state)].fsm.reset();
      }
    );

    // use the gripper on the left controller to continue to the next trial
    control.controller.controller[0].controller.addEventListener(
      "squeeze",
      () => {
        control.tasks[Number(control.fsm.state)].fsm.next();
      }
    );

    return control;
  }

  update(t) {
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
    updateTargetCursor();
    updateRobot();

    this.prevCtrlPose = { ...state.ctrlPose };
  }
}
