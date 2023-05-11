import Module from "./Module";
import * as T from "three";

export default class Grasping extends Module {
  constructor(utilities, options = {}) {
    super("grasping", utilities);

    // ========== options ==========
    this.controlMode = options.controlMode ?? "ab-hold";
    // =============================

    this.lastAction = undefined;
  }

  load() {
    this.loadControlMode(this.controlMode);
  }

  loadControlMode(mode) {
    if (!["ab-hold", "trigger-toggle", "trigger-hold"].includes(mode))
      throw new Error(`Control mode \"${mode}\" does not exist for Grasping`);

    this.controller.removeButtonAction("a", "grasping");
    this.controller.removeButtonAction("b", "grasping");
    this.controller.removeButtonAction("trigger", "grasping");
    this.controller.removeButtonAction("triggerpressed", "grasping");
    this.controller.removeButtonAction("triggerreleased", "grasping");
    this.controller.removeButtonAction("triggerstart", "grasping");
    this.controller.removeButtonAction("triggerend", "grasping");

    const open = () => {
      let pos1;
      let pos2;
      let scaler;
      if (window.robotName == "sawyer") {
        pos1 = window.robot.links[
          "right_gripper_l_finger_tip"
        ].getWorldPosition(new T.Vector3());
        pos2 = window.robot.links[
          "right_gripper_r_finger_tip"
        ].getWorldPosition(new T.Vector3());
        scaler = 1;
      } else if (window.robotName == "ur5") {
        pos1 = window.robot.links["left_inner_finger_pad"].getWorldPosition(
          new T.Vector3()
        );
        pos2 = window.robot.links["right_inner_finger_pad"].getWorldPosition(
          new T.Vector3()
        );
        scaler = -1;
      } else {
        return;
      }
      if (pos1.distanceTo(pos2) <= 0.08) {
        const leftPosition = window.leftFinger.link
          .translateY(0.001)
          .getWorldPosition(new T.Vector3());
        window.leftFinger.rigidBody.setNextKinematicTranslation(leftPosition);
        const rightPosition = window.rightFinger.link
          .translateY(scaler * -0.001)
          .getWorldPosition(new T.Vector3());
        window.rightFinger.rigidBody.setNextKinematicTranslation(rightPosition);
        this.controller.get().gamepad?.hapticActuators?.[0].pulse(0.25, 18);

        this.lastAction = "open";
      } else {
        return true;
      }
    };

    const close = () => {
      let pos1;
      let pos2;
      let scaler;
      if (window.robotName == "sawyer") {
        pos1 = window.robot.links[
          "right_gripper_l_finger_tip"
        ].getWorldPosition(new T.Vector3());
        pos2 = window.robot.links[
          "right_gripper_r_finger_tip"
        ].getWorldPosition(new T.Vector3());
        scaler = 1;
      } else if (window.robotName == "ur5") {
        pos1 = window.robot.links["left_inner_finger_pad"].getWorldPosition(
          new T.Vector3()
        );
        pos2 = window.robot.links["right_inner_finger_pad"].getWorldPosition(
          new T.Vector3()
        );
        scaler = -1;
      } else {
        return;
      }
      if (pos1.distanceTo(pos2) >= 0.01 && !window.grasped) {
        const leftPosition = window.leftFinger.link
          .translateY(-0.001)
          .getWorldPosition(new T.Vector3());
        window.leftFinger.rigidBody.setNextKinematicTranslation(leftPosition);
        const rightPosition = window.rightFinger.link
          .translateY(scaler * 0.001)
          .getWorldPosition(new T.Vector3());
        window.rightFinger.rigidBody.setNextKinematicTranslation(rightPosition);
        this.controller.get().gamepad?.hapticActuators?.[0].pulse(0.25, 18);

        this.lastAction = "close";
      } else {
        return true;
      }
    };

    switch (mode) {
      case "trigger-hold":
        this.controller.addButtonAction("triggerpressed", "grasping", close);
        this.controller.addButtonAction("triggerreleased", "grasping", open);
        this.modeInstructions =
          "Close: Squeeze and hold the trigger.\nOpen: Release the trigger.";
        break;
      case "trigger-toggle":
        this.closed = false;
        this.controller.addButtonAction("trigger", "grasping", () => {
          if (this.closed) {
            this.controller.addButtonAction(
              "triggerreleased",
              "grasping",
              () => {
                if (open()) this.closed = false;
              }
            );
          } else {
            this.controller.addButtonAction(
              "triggerreleased",
              "grasping",
              () => {
                if (close()) this.closed = true;
              }
            );
          }
        });
        this.modeInstructions =
          "Close: Squeeze the trigger.\nOpen: Squeeze the trigger again.";
        break;
      case "ab-hold":
        this.controller.addButtonAction("b", "grasping", open);
        this.controller.addButtonAction("a", "grasping", close);
        this.modeInstructions =
          "Close: Press and hold (a.\nOpen: Press and hold (b).";
        break;
      default:
        break;
    }
  }
}
