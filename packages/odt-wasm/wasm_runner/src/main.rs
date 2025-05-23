use std::fs;
use rs_lib::core::unzip;
use rs_lib::core::parse_content;
use rs_lib::core::parse_styles;

fn main() -> std::io::Result<()> {
    let data: Vec<u8> = fs::read("../extension-odt/test/odt_md/example-document.odt")?;
    println!("Read {} bytes", data.len());

    let files = unzip(data);

    // println!("files {:#?} ", files);

    let content = parse_content(files.get("content.xml").unwrap().to_vec());
    let styles = parse_styles(files.get("styles.xml").unwrap().to_vec());

    println!("content {:#?} ", content.body.text.list);

    Ok(())
}
