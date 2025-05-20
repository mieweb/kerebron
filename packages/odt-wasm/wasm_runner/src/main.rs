use std::fs;
use rs_lib::core::unzip;
use rs_lib::core::parseContent;
use rs_lib::core::parseStyles;

fn main() -> std::io::Result<()> {
    let data: Vec<u8> = fs::read("./example-document.odt")?;
    println!("Read {} bytes", data.len());

    let files = unzip(data);

    // println!("files {:#?} ", files);

    let content = parseContent(files.get("content.xml").unwrap().to_vec());
    let styles = parseStyles(files.get("styles.xml").unwrap().to_vec());

    println!("content {:#?} ", content.body.text.list);

    Ok(())
}
