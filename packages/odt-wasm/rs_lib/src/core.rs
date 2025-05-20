use std::collections::HashMap;
use std::io::Cursor;
use std::io::Read;


use crate::ods_structs::DocumentContent;
use crate::ods_structs::DocumentStyles;

// use serde_xml_rs::from_reader;
use quick_xml::de::from_reader;
// use serde_roxmltree::from_str;

pub fn unzip(zip_data: Vec<u8>) -> HashMap<String, Vec<u8>> {
    let reader = Cursor::new(zip_data.clone());
    let mut archive = zip::ZipArchive::new(reader).unwrap();

    let mut result: HashMap<String, Vec<u8>> = HashMap::new();

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).unwrap();
        if !file.is_file() {
            continue;
        }

        let filename = file.name().to_string();

        match filename.as_str() {
            "content.xml" | "styles.xml" => {
                let mut content = Vec::new();
                file.read_to_end(&mut content).unwrap();
                result.insert(filename, content);
            }
            other if other.ends_with("/content.xml") || other.ends_with(".png") || other.ends_with(".jpg") => {
                let mut content = Vec::new();
                file.read_to_end(&mut content).unwrap();
                result.insert(other.to_string(), content);
            }
            _ => {}
        }

    }

    result
}

pub fn parseContent(xml_bytes: Vec<u8>) -> DocumentContent {
    from_reader(&xml_bytes[..]).unwrap()
}

pub fn parseStyles(xml_bytes: Vec<u8>) -> DocumentStyles {
    from_reader(&xml_bytes[..]).unwrap()
}
