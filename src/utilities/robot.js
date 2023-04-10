import * as T from "three";
import {
  EE_TO_GRIPPER_OFFSET,
  EE_TO_THREE_ROT_OFFSET,
  T_ROS_to_THREE,
} from "./globals";
import { relToAbs, changeReferenceFrame } from "./math";

export function recurseMaterialTraverse(material, func) {
  if (material.length > 1) {
    material.forEach((mat) => {
      recurseMaterialTraverse(mat, func);
    });
  } else {
    func(material);
  }
}

export function computeGripper(eePose) {
  const gripper = new T.Object3D();
  gripper.position.copy(
    new T.Vector3(eePose.posi.x, eePose.posi.y, eePose.posi.z)
  );
  gripper.quaternion.copy(
    new T.Quaternion(eePose.ori.x, eePose.ori.y, eePose.ori.z, eePose.ori.w)
  );
  gripper.quaternion.multiply(EE_TO_THREE_ROT_OFFSET);
  if (window.robotName == "sawyer") {
    gripper.translateX(EE_TO_GRIPPER_OFFSET);
  }
  return gripper;
}

export function getCurrEEPose() {
  let posi = window.robotGroup.position.clone();
  let ori = window.robotGroup.quaternion.clone();
  let link = null;
  if (window.robotName == "sawyer") {
    link = window.robot.links.right_hand;
  } else if (window.robotName == "ur5") {
    link = window.robot.links.finger_tip;
  } else if (window.robotName == "spot") {
    link = window.robot.links.gripper;
  }
  if (link) {
    posi.add(link.getWorldPosition(new T.Vector3()).applyQuaternion(ori));
    ori.multiply(link.getWorldQuaternion(new T.Quaternion()));
  }
  return {
    posi: posi,
    ori: ori,
  };
}

export function getGripperPose(tip = false) {
  const gripper = new T.Object3D();
  gripper.position.copy(
    new T.Vector3(eePose.posi.x, eePose.posi.y, eePose.posi.z)
  );
  gripper.quaternion.copy(
    new T.Quaternion(
      eePose.ori.x,
      eePose.ori.y,
      eePose.ori.z,
      eePose.ori.w
    ).normalize()
  );
  return gripper;
}

/**
 *
 * @param {*} goalEERelRos
 * @returns True if the robot is updated, false otherwise
 */
export function updateRobot() {
  const goalEERelRos = changeReferenceFrame(
    window.goalEERelThree,
    T_ROS_to_THREE
  );
  const goal = window.adjustedControl(goalEERelRos);
  const currEEAbsThree = getCurrEEPose();

  const deltaPosi = currEEAbsThree.posi.distanceTo(goal.posi); // distance difference
  const deltaOri = currEEAbsThree.ori.angleTo(goal.ori); // angle difference

  if (deltaPosi > 1e-3 || deltaOri > 1e-3) {
    const result = window.relaxedIK.solve(
      [goal.posi.x, goal.posi.y, goal.posi.z],
      [goal.ori.w, goal.ori.x, goal.ori.y, goal.ori.z]
    );

    const joints = Object.entries(window.robot.joints).filter(
      (joint) =>
        joint[1]._jointType != "fixed" && joint[1].type != "URDFMimicJoint"
    );
    joints.forEach((joint) => {
      const jointIndex = window.robotConfigs.joint_ordering.indexOf(joint[0]);
      if (jointIndex != -1)
        window.robot.setJointValue(joint[0], result[jointIndex]);
    });

    window.linkToRigidBody.forEach((rigidBody, link) => {
      rigidBody.setNextKinematicTranslation(
        link.getWorldPosition(new T.Vector3())
      );
      rigidBody.setNextKinematicRotation(
        link.getWorldQuaternion(new T.Quaternion())
      );
    });
    return true;
  }
  return false;
}

export function resetRobot() {
  window.robotGroup.position.x = 0;
  window.robotGroup.position.z = 0;
  window.robotGroup.quaternion.copy(new T.Quaternion().identity());
  window.goalEERelThree.position.copy(new T.Vector3());
  window.goalEERelThree.quaternion.copy(new T.Quaternion().identity());
  window.relaxedIK.reset([]);
  updateRobot();
}
