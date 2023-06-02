# Studio

A web-based application for running robot experiments in VR. The application is hosted [here](https://wycongwisc.github.io/urdf-loader-test-vr/).

## Setup

### Prerequisite 
* Node.js: install the latest LTS version of Node.js (18.16.0 at time of writing) using [nvm](https://github.com/nvm-sh/nvm) (recommended) or the [Node.js installer](https://nodejs.org/en/download)

### Installation

First, clone the repository and pull the submodules with

```console
git submodule init
git submodule update
```

Then, `cd relaxed_ik_core` and follow that submodule's JavaScript WebAssembly Wrapper instructions [here](https://github.com/uwgraphics/relaxed_ik_core/tree/ranged-ik#javascript-webassembly-wrapper) to install its dependencies (e.g. Rust) and compile. 
Return to this repo `cd ..`

Finally, in this repo run the following commands:

```console
npm install
npm run build
```

## Development

For development, we used Android Debug Bridge (adb) to enable headset connection to the locally-running server, and to receive debug (console) information from the headset's browser.

_Note that `npm run build` must be executed everytime changes are made to the code._


### Debugging For the Quest

Prereqs:
* Visual Studio Code (VS Code) 
* Live Server extension for VS Code
* Developer Mode is Enabled in Quest
* Android Debug Bridge (adb) is installed
* Optional, but recommended: *Meta Quest Developer Hub* 
  * Provides helpful features like turning off Quests's proximity sensor

Wired Debugging:
1. Plug the Quest into the computer. View connected devices with `adb devices`
2. Start the application on a live server (port 5501) with VSCode.
3. Open the terminal and type the command `adb reverse tcp:<port> tcp:<port>` where `<port>` corresponds to the port the live server is running on. 
4. With the live server running, go to `http://localhost:<port>` in the Quest browser. The application should appear.
5. To use the chrome debugger, go to `chrome://inspect/#devices` in Google Chrome and click `inspect`.

Wireless Debugging:
1. Plug the Quest into the computer
2. Ensure both VR headset and computer are on the same WiFi network
3. `adb devices` to make sure VR headset is connected
4. `adb shell ip addr show wlan0` and get IP address after "inet" OR do: `adb shell ip route`
5. Restart adb with port 5555: `adb tcpip 5555`
6. `adb connect <Headset_IP_Address>:5555`
7. Port forwarding like above: `adb reverse tcp:<port> tcp:<port>`
8. Disconnect cable from VR headset!

_Note that `npm run build` must be executed everytime changes are made to the code._




# New Additions

### Control Scheme:

#### In the url, append "?hand=left" to change to left handed mode. Defaults to right handed mode.

Grip (depends on hand): start/stop controlling the robot (clutch)

Trigger (depends on hand): close robot gripper

left joystick: translate the robot

right joystick: rotate the robot

a: teleport

b: adjust first person control between robot->camera and camera->robot

- robot->camera: translate and rotate the robot to line up with the camera

- camera->robot: translate the camera to line up with the robot. translate and rotate the robot using the joysticks.

x: restart the current task

y: continue to the next task

### Drawing Task

Draw over an outlined curve on the whiteboard.

_options:_

debug (bool): Indicate to backend that data is for debugging instead of real experiment data

robotControlled (bool): Choose to draw by either holding the marker at the controller poisition or by having the robot hold the marker.

adjustedControl (bool): Rotate marker to hold controller differently when controller controlled, or move center of rotation when robot controlled

distFromWhiteboard (float): Distance away from whiteboard for the marker to start drawing

drawVibrationStrength (float): Specifies how much controller vibrates when drawing. default: 0 or no vibration

rotationBased (bool): Choose whether the drawing functionality will involve a projection perpendicular to the whiteboard (false) or parallel to the marker (true).

stopOnCollision (bool): Add fake collision behavior between the marker and the whiteboard (needs to be fixed for robot using window.adjustedControl).

pointerSize (float): Size of projection pointer. If not specified, there will be no projection pointer.

color (str): Color of drawn lines.

lineWidth (float): Width of drawn lines.

traceName (str): Name of trace to draw over specified in traces.js.

curveScale (float): Amount the trace is scaled by.

distFromCurve (float): Distance from start and end points to be considered for clear condition.

bufferSize (int): Determines frequency of network requests.

### Erasing Task

Erase pre-existing lines on the whiteboard.

_options:_

debug (bool): Indicate to backend that data is for debugging instead of real experiment data

robotControlled (bool): Choose to draw by either holding the marker at the controller poisition or by having the robot hold the marker.

distFromWhiteboard (float): Distance away from whiteboard for all corners of eraser to start erasing

eraseVibrationStrength (float): Specifies how much controller vibrates when erasing. default: 0 or no vibration

stopOnCollision (bool): Add fake collision behavior between the eraser and the whiteboard (needs to be fixed for robot using window.adjustedControl).

color (str): Color of pre-existing lines.

lineWidth (float): Width of pre-existing lines.

pathName (str): Name of line to erase specified in erasePaths.js.

bufferSize (int): Determines frequency of network requests.

### window.setRobot(robotName)

Change the current robot.

robotName = "sawyer" -> set the robot to sawyer

robotName = "ur5" -> set the robot to ur5

robotName = "spotArm" -> set the spot robot with stationary IK

robotName = "mobileSpotArm" -> set the spot robot with mobile IK

#### You can also change the robot between tasks by setting "robot" in a Task's options to the robotName

### window.adjustedControl(goal)

Adjust the end-effector goal before it's passed into the IK solver (useful for adjusting the center of rotation or faking collisions)

- goal (Object3D): 3d mesh representing the end effector goal

- return {posi: Vector3, ori: Quaternion}

### Added Parameters to getURDFFromURL in index.js:

defaultPosi (Vector3): default position of the robot (the y position is extra important)

fpCamOffset (Vector3): offset of the camera from the robot in first person mode (the y position is the offset from the ground)

#### Before all calls to getURDFFromURL, make sure to set window.robotName to the name of the starting robot

### Added Fields to teleportvr:

controlScheme (string): how pressing the "a" button control the teleportation

- "hold": hold "a" to show the teleport indicator and release to teleport (recommended)

- "": touch the joystick to show the teleport indicator and press it to teleport

rotationScheme (string): how to control the player's rotation when teleporting

- "ee": teleport to face the end effector (recommended)

- "joystick": control the direction of teleportation with the joystick

- "": don't rotate during teleportation

fpClipDist (float): how close the teleport indicator needs to be to the robot to switch to first person mode

## Design

Any class with a `static async init()` method should use this method to create a class instance instead of the constructor. For example:

```js
const control = await Control.init(); // do this
const control = new Control(); // not this
```

This is because the class requires asynchrounous operations on initialization which can not be done in the constructor. For more information, see this [post](https://stackoverflow.com/questions/43431550/async-await-class-constructor).

_NOTE: The following headings and subheadings correspond to the file structure of the application._

### /index.js

This is the entry point of the application. It sets up the THREE scene, loads in the robot and its corresponding physics objects, and initializes the [components](#components) of the application. It also creates three separate loops: one for logic, one for physics, and one for rendering.

### Components

Components form the core functionality of the application and are used across all tasks.

#### /Control.js

This contains an array of tasks and a finite state machine that is used to navigate between tasks. The update function calls the update function of the current task as determined by the state of the finite state machine.

#### /Controller.js

This is a wrapper class that provides a cleaner interface for configuring the VR controllers. Since THREE only provides events for the trigger and grip button, the rest of the buttons must be accessed through the `gamepad.buttons` property of the controller (see the official documentation [here](https://www.w3.org/TR/webxr-gamepads-module-1/)).

This class is designed to map all controls to a single "main" controller by default (which is determined by the `hand` property). However you can still add functionality to the other controller by manually calling the `get(hand)` method. This is probably not a good design decision and should be changed in the future.

_NOTE: The `squeeze` event is renamed to `grip` and the `select` event is renamed to `trigger` in order to maintain consistency._

#### /Condition.js

This contains an array of [modules](#modules) and a finite state machine that is used to control the "control state" (ex. `IDLE`, `DRAG_CONTROL`, `REMOTE_CONTROL`, etc.). This state machine is constructed dynamically because it is shared by all of the modules.

This class is designed to setup the various conditions an experiment may have, which is determined by the array of modules that are passed in.

#### /Data.js

This contains all functionality relating to data storage and the Google Sheets backend. A buffer is used to minimize the number of API calls that need be made. By default, the application will wait until it obtains 500 rows of data before making a `POST` request.

_NOTE: The `SCRIPT_PATH` variable must be updated whenever the Google Apps Script is updated. More on this [here]._

#### /UI.js

This contains methods that are used to create and interact with UI elements in VR (through raycasting). The `elements` array contains all UI elements that have been created and can be logged for debugging purposes.

### Modules

Modules add specific functionality to the environment and can be used in conjunction with the [Condition](#conditionjs) class to create the desired environment for each portion of an experiment.

_NOTE: Modules that are commented out are outdated and must be updated in order to work._

### Objects

These are wrapper classes that are used to load in the corresponding object models (`.glb` or `.gltf`) and create the corresponding physics components. This is done manually but in the future it may be possible to do this automatically. The code to do this already exists in the `loadRAPIERfromGLTF()` function in `/utilities/loaders` however it can not be used due to some shortcomings of the RAPIER library (for more information, see the method header).

Each class also contains methods that handle object interactions (ex. picking up the block).

### Tasks

Each task inherits from the `Task` parent class, which contains a finite state machine for the trials within the task and some methods for data logging. Each task can use the methods exposed from the parent class (`onStart()`, `onStop()`, `onUpdate()`) to perform task-specific operations. The constructor for each class passes an array of callback functions to the super class which are called before each trial begins:

```js
// in the constructor of the Stack class
super('stack', params, condition, options, [
    () => { ... }, // set up first trial
    () => { ... } // set up second trial
])
```

These can be used to set up a trial before it begins. Each task also contains an `objects` property that contains all non-robot objects involved in the task. The data associated with these objects (position, orientation, scale) are recorded and stored in the database.

Tutorial tasks are used to teach the user how to do certain things. These must be used with the corresponding modules (ex. `DragControl` with `DragControlTutorial`), otherwise there will be no way to progress through the task.

### UI

These are wrapper classes that are used by the `UI` class to create the VR UI. Internally, it uses [this](https://github.com/felixmariotto/three-mesh-ui) library.

### Utilities

This folder contains a collection of functions and contants that are used throughout the application.

## Miscallaneous

### Troubleshooting
1. If errors are encountered when pressing "Enter VR", try changing live server to host an https page. See [this YouTube video](https://www.youtube.com/watch?v=v4jgr0ppw8Q&t=337s) for instructions.

### Setting up a Google Sheets Backend with Google Apps Scripts

#### Creating the Google Apps Script

First, create a Google Apps Script by doing one of the following (either option is fine):

1. In Google Drive, go to `New` > `More` > `Google Apps Scripts`
2. In a spreadsheet, go to `Extensions` > `Apps Scripts`

Next, create a script and define a `doPost()` function. This function will execute everytime a `POST` request is sent to the deployed script (more on deployment later) and will receive all data in the request. For example,

```js
function doPost(e) {
  try {
    // do stuff with data here

    // access the body of the POST request
    console.log(JSON.parse(e.postData.contents));
  } catch (error) {
    Logger.log(error);
  }
}
```

If multiple users are making requests to the script at the same time, add the following lines to the `doPost()` function to avoid concurrent writing:

```js
const lock = LockService.getScriptLock();
lock.waitLock(30000); // 30 s

try {
  // ...
} catch (error) {
  // ...
} finally {
  lock.releaseLock();
}
```

The script will attempt to acquire the lock for up to 30 seconds. When the script is locked, only the user who obtained the lock will be able to execute the code.

#### Helpful Functions

##### Writing to a Spreadsheet

The following lines of code will write to a sheet inside of a spreadsheet given the ID of the spreadsheet and the name of the sheet (_spreadsheet_ refers to the file itself which can contain many _sheets_ that are accessible in the bottom tab).

```js
const spreadsheet = SpreadsheetApp.openById(<id>);
const sheet = spreadsheet.getSheetByName(<sheet-name>);
sheet.getRange(<row>, <column>, <numRows>, <numColumns>).setValues(<data>)
```

To find the ID of a spreadsheet, copy the string located at `<id>` in the spreadsheet's URL (see below).

```js
https://docs.google.com/spreadsheets/d/<id>/edit#gid=0
```

To append rows to the end of a sheet, replace `<row>` with `sheet.getLastRow() + 1`. Note that `<data>` must be a two dimensional array. For a complete list of methods, see the [official documentation](https://developers.google.com/apps-script/reference/spreadsheet).

##### Creating a Spreadsheet

The following line of code will create a spreadsheet inside the root folder.

```js
const spreadsheet = SpreadsheetApp.create(<name>);
```

To create a spreadsheet in a different folder, first create the spreadsheet in the root folder, copy the file into the desired folder, then remove the file from the root folder.

```js
const spreadsheet = SpreadsheetApp.create(<name>);

// gets the first folder with the given name
const folder = DriveApp.getFoldersByName(<folder-name>).next();
const file = DriveApp.getFileById(spreadsheet.getId());
folder.addFile(file);

DriveApp.getRootFolder().removefile(file);
```

Note that a spreadsheet will contain a sheet named `Sheet1` on creation.

#### Deployment

To deploy the script, go to `Deploy` > `New Deployment` > `Deploy` (make sure to deploy as a Web app). Then, copy the URL of the deployed Web app.

##### Connecting to the Frontend

To send a request to your deployed script, use the `fetch` API with the URL obtained above. For example,

```js
fetch(<script-url>, {
    method: 'POST',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    },
    mode: 'no-cors',
    body: JSON.stringify(<your-data>)
})
```

#### Limitations

A spreadsheet cannot contain more than [10 million cells](https://support.google.com/drive/answer/37603). If the amount of data may exceed this number, consider dynamically creating spreadsheets once the current spreadsheet reaches a certain number of rows. Additionally, deployed Apps Script have daily quotas, which can be found [here](https://developers.google.com/apps-script/guides/services/quotas).
