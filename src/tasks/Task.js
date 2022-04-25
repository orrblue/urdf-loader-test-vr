import * as T from 'three';
import { v4 as id } from 'uuid'
import { getCurrEEpose } from '../utils';


/**
 * Abstract Class Task
 */
export default class Task {
    constructor(params = {}) {
        window.task = this;
        this.name = params.name;
        this.scene = params.scene;
        this.taskControl = params.taskControl;
        this.disabledControlModes = params.disabledControlModes;
        this.dataControl = params.dataControl;
        this.targetCursor = params.targetCursor;

        this.eePose = getCurrEEpose();
        this.id = id();
        this.clock = new T.Clock({ autoStart: false });

        if (this.constructor == Task) throw new Error("Cant instantiate class Task");
    }

    update() {
        throw new Error("Method 'update()' must be implemented");
    }

    destruct() {
        throw new Error("Method 'destruct()' must be implemented");
    }
}