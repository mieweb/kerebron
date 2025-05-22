pub mod core;
pub mod ods_structs;

use wasm_bindgen::prelude::*;
use serde_wasm_bindgen::to_value;

#[wasm_bindgen]
pub fn echo(zip_data: Vec<u8>) -> Vec<u8> {
    zip_data
}

#[wasm_bindgen]
pub fn unzip(zip_data: Vec<u8>) -> JsValue {
    to_value(&core::unzip(zip_data)).unwrap()
}

#[wasm_bindgen]
pub fn parse_content(xml_bytes: Vec<u8>) -> JsValue {
    to_value(&core::parse_content(xml_bytes)).unwrap()
}

#[wasm_bindgen]
pub fn parse_styles(xml_bytes: Vec<u8>) -> JsValue {
    to_value(&core::parse_styles(xml_bytes)).unwrap()
}

#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
  a + b
}

#[wasm_bindgen]
pub struct Greeter {
  name: String,
}

#[wasm_bindgen]
impl Greeter {
  #[wasm_bindgen(constructor)]
  pub fn new(name: String) -> Self {
    Self { name }
  }

  pub fn greet(&self) -> String {
    format!("Hello {}!", self.name)
  }
}




#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn it_adds() {
    let result = add(1, 2);
    assert_eq!(result, 3);
  }

  #[test]
  fn it_greets() {
    let greeter = Greeter::new("world".into());
    assert_eq!(greeter.greet(), "Hello world!");
  }
}
