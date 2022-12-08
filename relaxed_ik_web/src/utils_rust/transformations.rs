extern crate web_sys;

use nalgebra::{Vector3, UnitQuaternion, Quaternion, Vector4};

pub fn quaternion_log(q: UnitQuaternion<f64>) -> Vector3<f64> {
    let mut out_vec: Vector3<f64> = Vector3::new(q.i, q.j, q.k);
    if q.w.abs() < 1.0 {
        let a = q.w.acos();
        let sina = a.sin();
        if sina.abs() >= 0.005 {
            let c = a / sina;
            out_vec *= c;
        }
    }
    out_vec
}

pub fn quaternion_exp(v: Vector3<f64>) -> UnitQuaternion<f64> {
    let mut qv: Vector4<f64> = Vector4::new(1.0, v[0], v[1], v[2]);
    let a = qv.norm();
    let sina = a.sin();
    if sina.abs() >= 0.005 {
        let c = sina/a;
        qv *= c;
    }
    UnitQuaternion::from_quaternion(Quaternion::new(a.cos(), qv[1], qv[2], qv[3]))
}

pub fn quaternion_from_angleaxis(angle: f64, axis: Vector3<f64>) -> UnitQuaternion<f64> {
    let a = angle * 2.0;
    let axis_len = axis.norm();
    quaternion_exp( axis * (a / axis_len))
}

pub fn quaternion_disp(q: UnitQuaternion<f64>, q_prime: UnitQuaternion<f64>) -> Vector3<f64> {
    quaternion_log( q.inverse()*q_prime )
}

pub fn quaternion_dispQ(q: UnitQuaternion<f64>, q_prime: UnitQuaternion<f64>) -> UnitQuaternion<f64> {
    q.inverse()*q_prime
}

pub fn angle_between_quaternion(q: UnitQuaternion<f64>, q_prime: UnitQuaternion<f64>) -> f64 {
    quaternion_disp(q, q_prime).norm() * 2.0
}

pub fn angle_between_swing_quaternion(q: UnitQuaternion<f64>, q_prime: UnitQuaternion<f64>, d:Vector3<f64>) -> f64 {
    let rotation = q.inverse()*q_prime;
    let rel_d = q.inverse() * d;
    let (swing, twist) = swing_twist_decomposition(rotation, rel_d);
    quaternion_log(swing).norm() * 2.0
}

pub fn angle_between_twist_quaternion(q: UnitQuaternion<f64>, q_prime: UnitQuaternion<f64>, d:Vector3<f64>) -> f64 {
    let rotation = q.inverse()*q_prime;
    let rel_d = q.inverse() * d;
    let (swing, twist) = swing_twist_decomposition(rotation, rel_d);
    quaternion_log(twist).norm() * 2.0
}

// https://stackoverflow.com/questions/3684269/component-of-a-quaternion-rotation-around-an-axis
pub fn swing_twist_decomposition(q: UnitQuaternion<f64>, d: Vector3<f64>) -> (UnitQuaternion<f64>, UnitQuaternion<f64>) {

    let ra: Vector3<f64> =  Vector3::new(q.i, q.j, q.k);

    // TODO: works on singularity
    // http://allenchou.net/2018/05/game-math-swing-twist-interpolation-sterp/
    // singularity: rotation by 180 degree
    // let epsilon = 1e-6;
    
    // if (ra.norm() < epsilon)
    // {
    //     let rotatedTwistAxis = q * d;
    //     let swingAxis = d.cross(&rotatedTwistAxis);
    
    //     // always twist 180 degree on singularity
    //     let twist: UnitQuaternion<f64> = quaternion_from_angleaxis(3.14159265, d);

    //     if (swingAxis.norm() > epsilon) {
    //         let swingAngle = (nalgebra::dot(&d, &rotatedTwistAxis) / (d.norm() * rotatedTwistAxis.norm())).acos();
    //         let swing: UnitQuaternion<f64> = quaternion_from_angleaxis(swingAngle, swingAxis);
    //         return (twist, swing);
    //     }
    //     else
    //     {
    //         // more singularity: 
    //         // rotation axis parallel to twist axis
    //         let swing: UnitQuaternion<f64> = UnitQuaternion::from_quaternion(Quaternion::new(1., 0., 0., 0.)); // no swing
    //         return (twist, swing);
    //     }
    // }

    let p: Vector3<f64> =  vector_projection(ra.clone(), d.clone());
    let twist: UnitQuaternion<f64>;
    if (nalgebra::dot(&d, &ra) > 0.0) {
        twist = UnitQuaternion::from_quaternion(Quaternion::new(q.w, p.x, p.y, p.z));
    } else {
        twist = UnitQuaternion::from_quaternion(Quaternion::new(-q.w, -p.x, -p.y, -p.z));
    }
    let mut twist_conjugate: UnitQuaternion<f64> = twist.clone();
    twist_conjugate.conjugate_mut();
    let swing: UnitQuaternion<f64> = q * twist_conjugate;

    // let twist_array = js_sys::Array::new();
    // twist_array.push(&twist.i.into());
    // twist_array.push(&twist.j.into());
    // twist_array.push(&twist.k.into());
    // web_sys::console::log(&twist_array);

    // let d_array = js_sys::Array::new();
    // d_array.push(&d.x.into());
    // d_array.push(&d.y.into());
    // d_array.push(&d.y.into());
    // web_sys::console::log(&d_array);

    (swing, twist)
}

// https://en.wikipedia.org/wiki/Vector_projection
pub fn vector_projection(a: Vector3<f64>, b: Vector3<f64>) -> Vector3<f64> {
    nalgebra::dot(&a, &b) / nalgebra::dot(&b, &b) * b 
}