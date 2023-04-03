import * as T from "three";
import Task from "./Task";
import Table from "../objects/Table";
import Box from "../objects/Box";
import Cup from "../objects/Cup";
import { computeGripper } from "../utilities/robot";
import WaterParticle from "../objects/WaterParticle";

export default class Pouring extends Task {
  static async init(params, condition, options = {}) {
    const task = new Pouring(params, condition, options);
    const numParticles = options.numParticles ?? 30;
    task.numParticles = numParticles;
    let particles = [];
    for (let i = 0; i < numParticles; i++) {
      particles.push(await WaterParticle.init(params));
    }
    task.objects = {
      particles: particles,
      cup: await Cup.init(params),
      box: await Box.init(params),
      table: await Table.init(params),
    };
    return task;
  }

  constructor(params, condition, options) {
    super("pouring", params, condition, options, [
      () => {
        this.objects.cup.set({ position: new T.Vector3(0.6, 1, -0.25) });
        for (let i = 0; i < this.objects.particles.length; i++) {
          this.objects.particles[i].set({
            position: new T.Vector3(
              0.595 + Math.random() * 0.01,
              1.05 + i * 0.05,
              -0.255 + Math.random() * 0.01
            ),
          });
        }
        this.objects.box.set({ position: new T.Vector3(0.5, 1, 0) });
      },
    ]);
  }

  async onStart() {
    this.instructions = this.ui.createContainer("pouring-instructions", {
      height: 0.4,
      position: new T.Vector3(2, 1.52, 0),
      rotation: new T.Euler(0, -Math.PI / 2, 0, "XYZ"),
      backgroundOpacity: 0,
    });
    this.instructions.appendChild(
      this.ui.createText("Pouring Task\n", { fontSize: 0.08 })
    );
    this.instructions.appendChild(
      this.ui.createText(
        this.text ??
          "Complete the task by pouring the contents of the cup into the box. Close the box after you are done.\n\n"
      )
    );

    this.particleCounter = this.ui.createContainer("particle-counter", {
      height: 0.1,
      width: 0.2,
      backgroundOpacity: 0,
    });
    this.particleCounterText = this.ui.createText("- / -", { fontSize: 0.025 });
    this.particleCounter.appendChild(this.particleCounterText);

    this.trialCounterText = this.ui.createText("Trial: - / -");
    this.instructions.appendChild(this.trialCounterText);

    this.instructions.show();
    this.particleCounter.show();
    this.objects.table.set({
      position: new T.Vector3(0.8, 0, 0),
      rotation: new T.Euler(0, -Math.PI / 2, 0, "XYZ"),
    });
  }

  onStop() {
    this.instructions.hide();
    this.particleCounter.hide();
  }

  onUpdate(t, info) {
    const particles = this.objects.particles;
    const table = this.objects.table;
    const box = this.objects.box;
    const cup = this.objects.cup;
    const gripper = computeGripper(info.currEEAbsThree);

    cup.update(this.world, gripper);

    table.update(this.world, this.controller);

    // ~ go to the next trial if the box or cup hits the ground ~

    this.world.contactsWith(this.ground, (c) => {
      for (const object of [box, cup]) {
        if (object.colliders.includes(c)) {
          this.fsm.next();
          return;
        }
      }
    });

    // ~ count how many particles are in the box ~
    // https://math.stackexchange.com/questions/1472049/check-if-a-point-is-inside-a-rectangular-shaped-area-3d

    const p1 = box.meshes[0].position;
    const p2 = box.meshes[0].localToWorld(new T.Vector3(box.size.x, 0, 0));
    const p3 = box.meshes[0].localToWorld(new T.Vector3(0, box.size.z, 0));
    const p4 = box.meshes[0].localToWorld(new T.Vector3(0, 0, box.size.y));

    const [i, j, k] = [new T.Vector3(), new T.Vector3(), new T.Vector3()];
    i.subVectors(p2, p1);
    j.subVectors(p3, p1);
    k.subVectors(p4, p1);

    let numInside = 0;

    for (const particle of particles) {
      const v = new T.Vector3();
      v.subVectors(particle.meshes[0].position, p1);
      if (
        0 < v.dot(i) &&
        v.dot(i) < i.dot(i) &&
        0 < v.dot(j) &&
        v.dot(j) < j.dot(j) &&
        0 < v.dot(k) &&
        v.dot(k) < k.dot(k)
      ) {
        numInside++;
      }
    }

    let numContacts = 0;
    const lid = box.colliders[5];
    for (const i of [1, 2, 3, 4]) {
      this.world.contactsWith(box.colliders[i], (collider) => {
        if (collider === lid) numContacts++;
      });
    }

    // lid must contact all four sides of the box
    if (numContacts === 4) {
      this.fsm.next();
    }

    // ~ update ui elements ~

    this.instructions?.getObject().lookAt(this.camera.position);
    this.particleCounter?.getObject().lookAt(this.camera.position);

    // position particle counter above the center of the box
    const temp = box.meshes[0].clone();
    temp.translateX(box.size.x / 2);
    temp.translateY(box.size.z / 2);
    temp.translateZ(-0.05);

    this.particleCounter?.getObject().position.copy(temp.position);

    this.trialCounterText?.set(
      `Trial: ${Number(this.fsm.state) + 1} / ${this.numRounds}`
    );
    this.particleCounterText?.set(`${numInside} / ${particles.length}`);
  }
}
