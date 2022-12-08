# relaxed_ik_web
## About
This is the WebAssembly version of [RelaxedIK solver](https://github.com/uwgraphics/relaxed_ik). 

## Installation
(The following steps were tested on Ubuntu 18.04, but it should also work in Windows 10)
1. [Install Rust](https://www.rust-lang.org/tools/install) 
2. `cargo install wasm-pack`
    * if there is a `linker 'cc' not found` error, run `sudo apt install gcc`
	* if it complains about openssl, on Ubuntu install it by `sudo apt-get install libssl-dev pkg-config openssl`. For windows, download and install [perl](https://strawberryperl.com/).
3. Clone this repo
4. Pull subrepos by 
```
git submodule init
git submodule update
```
## Usage
1. Compile to WebAssembly
	```
	cd relaxed_ik_web
	wasm-pack build --target web
	```
2. A simple example can be found in `index.html`
	* import RelaxedIK from WebAssembly
		```
		import init, {RelaxedIK} from "./pkg/relaxed_ik_web.js";
		```
	* Initiate a solver. `robot_info` is the robot config file.
	`robot_nn_config` is the robot self-collision neural network.
	`env_config` has the parameters of obstacles.
		```
		let relaxedik = new RelaxedIK(robot_info, robot_nn_config, env_config);
		```
	* `goal_pos` is the end-effector's position; `goal_rot` is the end-effector's orientation in quaternion.
		```
		let res = relaxedik.solve(goal_pos, goal_rot);
		```
	* To move the robot back to its home position:
		```
		// Move the robot to the init position in robot config file
		let joint_angles = [];
		// Move the robot to given joint angles (7 numbers for 7 joints)
		// let joint_angles = [0.04201808099852697 + 0.4, 0.11516517933728028, -2.1173004511959856, 1.1497982678125709, -1.2144663084736145, -2.008953561788951, 0.7504719405723105 + 0.4];
		relaxedik.recover_vars(joint_angles);
		```

## Reference
1. [Mozilla - Compiling from Rust to WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly/Rust_to_wasm)
2. [serde_json]( https://rustwasm.github.io/wasm-bindgen/reference/arbitrary-data-with-serde.html)
