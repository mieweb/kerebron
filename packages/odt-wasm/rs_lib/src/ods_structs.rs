use serde::Deserialize;
use serde::Serialize;

// https://en.wikipedia.org/wiki/OpenDocument_technical_specification
// TODO https://git.libreoffice.org/core/+/refs/heads/master/schema/libreoffice/OpenDocument-v1.4+libreoffice-schema.rng
// TODO https://git.libreoffice.org/core/+/refs/heads/master/schema/odf1.4/OpenDocument-v1.4-schema.rng
// https://docs.libreoffice.org/schema.html
// https://wiki.documentfoundation.org/Development/ODF_Implementer_Notes/List_of_LibreOffice_ODF_Extensions

// @TODO Serde prefixes: https://github.com/tafia/quick-xml/issues/218

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum TableCellItem {
//     #[serde(rename = "text:p")]
    #[serde(rename = "p")]
    TextParagraph(TextParagraph),

//     #[serde(rename = "table:table")]
    #[serde(rename = "table")]
    TableTable(TableTable),

//     #[serde(rename = "text:list")]
    #[serde(rename = "list")]
    TextList(TextList),

    #[serde(other)]
    Unknown
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TableCell {
    #[serde(default)]
    #[serde(rename = "$value")]
    pub list: Vec<TableCellItem>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TableColumn {
//     #[serde(rename = "@table:number-columns-repeated")]
    #[serde(default)]
    #[serde(rename = "@number-columns-repeated")]
    pub number_columns: u32
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TableRow {
//     #[serde(rename = "table:table-cell")]
    #[serde(rename = "table-cell")]
    pub cells: Vec<TableCell>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TableTable {
//     #[serde(rename = "table:table-column")]
    #[serde(rename = "table-column")]
    pub columns: Vec<TableColumn>,

//     #[serde(rename = "table:table-row")]
    #[serde(rename = "table-row")]
    pub rows: Vec<TableRow>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct FontFaceDecl {
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct Chars(u32);
impl Default for Chars {
    fn default() -> Self {
        Chars(1)
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextSpace {
//     #[serde(rename = "@text:c")]
    #[serde(default)]
    #[serde(rename = "@c")]
    chars: Chars
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum TextSpanItem {
//     #[serde(rename = "text:s")]
    #[serde(rename = "s")]
    TextSpace(TextSpace),
//     #[serde(rename = "text:tab")]
    #[serde(rename = "tab")]
    TextTab,
//     #[serde(rename = "text:line-break")]
    #[serde(rename = "line-break")]
    TextLineBreak,

    #[serde(rename = "$text")]
    Text(String),

    #[serde(other)]
    Unknown
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextSpan {
//     #[serde(rename = "office:annotation")]
    #[serde(default)]
    #[serde(rename = "annotation")]
    pub annotations: Vec<OfficeAnnotation>,

    #[serde(default)]
    #[serde(rename = "$value")]
    pub list: Vec<TextSpanItem>,

//     #[serde(rename = "@text:style-name")]
    #[serde(rename = "@style-name")]
    pub style_name: Option<String>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum TextLinkItem {
//     #[serde(rename = "text:span")]
    #[serde(rename = "span")]
    TextSpan(TextSpan),

    #[serde(rename = "$text")]
    Text(String)
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextLink {
//     #[serde(rename = "@xlink:href")]
    #[serde(rename = "@href")]
    pub href: String,

//     #[serde(rename = "@text:style-name")]
    #[serde(rename = "@style-name")]
    pub style_name: String,

    #[serde(default)]
    #[serde(rename = "$value")]
    pub list: Vec<TextLinkItem>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextBookmark {
//     #[serde(rename = "@text:name")]
    #[serde(rename = "@name")]
    pub name: String
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextBookmarkStart {
//     #[serde(rename = "@text:name")]
    #[serde(rename = "@name")]
    pub name: String
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextBookmarkEnd {
//     #[serde(rename = "@text:name")]
    #[serde(rename = "@name")]
    pub name: String
}

/* Sample HR:
  text:anchor-type="as-char"
  style:rel-width="100%"
  draw:z-index="0"
  draw:style-name="gr1"
  draw:text-style-name="P26"
  svg:width="0.0012in"
  svg:height="0.0213in"
*/
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DrawRect {
//     #[serde(rename = "@style:rel-width")]
    #[serde(rename = "@rel-width")]
    pub width: String
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DrawObject {
//     #[serde(rename = "@xlink:href")]
    #[serde(rename = "@href")]
    pub href: String
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DrawImage {
//     #[serde(rename = "@xlink:href")]
    #[serde(rename = "@href")]
    pub href: String
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
//@XmlText('value')
pub struct SvgDesc {
  value: String
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DrawFrame {
//     #[serde(rename = "draw:object")]
    #[serde(rename = "object")]
    object: Option<DrawObject>,
//     #[serde(rename = "draw:image")]
    #[serde(rename = "image")]
    image: Option<DrawImage>,
//     #[serde(rename = "svg:desc")]
    #[serde(rename = "desc")]
    description: Option<SvgDesc>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DrawEquation {
    #[serde(rename = "@draw:name")]
    name: String,
    #[serde(rename = "@draw:formula")]
    formula: String
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DrawEnhancedGeometry {
    #[serde(rename = "draw:equation")]
    equations: Vec<DrawEquation>,

    #[serde(rename = "@draw:enhanced-path")]
    path: String,
    #[serde(rename = "@drawooo:enhanced-path")]
    path2: Option<String>,
    #[serde(rename = "@drawooo:sub-view-size")]
    sub_view_size: String // = ''
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum DrawCustomShapeItem {
    #[serde(rename = "draw:enhanced-geometry")]
    DrawEnhancedGeometry,
    #[serde(rename = "text:p")]
    TextParagraph,
    #[serde(other)]
    Unknown
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DrawCustomShape {
  #[serde(rename = "@svg:x")]
  x: String, //  = ''
  #[serde(rename = "@svg:y")]
  y: String, //  = ''
  #[serde(rename = "@svg:width")]
  width: String, //  = ''
  #[serde(rename = "@svg:height")]
  height: String, //  = ''
  #[serde(rename = "@draw:style-name")]
  style_name: String,

    #[serde(default)]
    #[serde(rename = "$value")]
  list: Vec<DrawCustomShapeItem>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DrawG {
    #[serde(rename = "draw:custom-shape")]
    list: Vec<DrawCustomShape>,

    #[serde(rename = "@draw:style-name")]
    style_name: String
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextTab {
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextLineBreak {
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct SoftPageBreak {
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextChangeStart {
//     #[serde(rename = "@text:change-id")]
    #[serde(rename = "@change-id")]
    change_id: String
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextChangeEnd {
//     #[serde(rename = "@text:change-id")]
    #[serde(rename = "@change-id")]
    change_id: String
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum TextParagraphItem {
//     #[serde(rename = "text:a")]
    #[serde(rename = "a")]
    TextLink(TextLink),
//     #[serde(rename = "text:span")]
    #[serde(rename = "span")]
    TextSpan(TextSpan),
//     #[serde(rename = "text:tab")]
    #[serde(rename = "tab")]
    TextTab,
//     #[serde(rename = "text:line-break")]
    #[serde(rename = "line-break")]
    TextLineBreak,

//     #[serde(rename = "text:soft-page-break")]
    #[serde(rename = "soft-page-break")]
    SoftPageBreak,
//     #[serde(rename = "text:s")]
    #[serde(rename = "s")]
    TextSpace(TextSpace),
//     #[serde(rename = "text:change-start")]
    #[serde(rename = "change-start")]
    TextChangeStart(TextChangeStart),
//     #[serde(rename = "text:change-end")]
    #[serde(rename = "change-end")]
    TextChangeEnd(TextChangeEnd),
//     #[serde(rename = "text:bookmark")]
    #[serde(rename = "bookmark")]
    TextBookmark(TextBookmark),
    #[serde(rename = "bookmark-start")]
    TextBookmarkStart(TextBookmarkStart),
    #[serde(rename = "bookmark-end")]
    TextBookmarkEnd(TextBookmarkEnd),

//     #[serde(rename = "draw:rect")]
    #[serde(rename = "rect")]
    DrawRect(DrawRect),
//     #[serde(rename = "draw:frame")]
    #[serde(rename = "frame")]
    DrawFrame(DrawFrame),
//     #[serde(rename = "draw:g")]
    #[serde(rename = "g")]
    DrawG(DrawG),
//     #[serde(rename = "draw:custom-shape")]
    #[serde(rename = "custom-shape")]
    DrawCustomShape(DrawCustomShape),

    #[serde(rename = "$text")]
    Text(String),

    #[serde(other)]
    Unknown
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextParagraph {
    #[serde(default)]
    #[serde(rename = "$value")]
//     #[serde(flatten)]
    pub list: Vec<TextParagraphItem>,

    #[serde(default)]
//     #[serde(rename = "text:annotation")]
    #[serde(rename = "annotation")]
    pub annotations: Vec<OfficeAnnotation>,

//     #[serde(rename = "@text:style-name")]
    #[serde(rename = "@style-name")]
    pub style_name: String
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextIndexBody {
//     #[serde(rename = "text:p")]
    #[serde(default)]
    #[serde(rename = "p")]
    pub list: Vec<TextParagraph>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TableOfContent {
//     #[serde(rename = "text:index-body")]
    #[serde(rename = "index-body")]
    pub index_body: TextIndexBody
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct OfficeAnnotation {
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum TextListItemEnum {
//     #[serde(rename = "text:p")]
    #[serde(rename = "p")]
    TextParagraph(TextParagraph),

//     #[serde(rename = "text:list")]
    #[serde(rename = "list")]
    TextList(TextList),

    #[serde(other)]
    Unknown
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextListItem {
    #[serde(default)]
    #[serde(rename = "$value")]
    list: Vec<TextListItemEnum>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextList {
    #[serde(default)]
//     #[serde(rename = "text:list-item")]
    #[serde(rename = "list-item")]
    pub list: Vec<TextListItem>,

//     #[serde(rename = "@xml:id")]
    #[serde(rename = "@id")]
    pub id: Option<String>,
//     #[serde(rename = "@text:continue-numbering")]
    #[serde(rename = "@continue-numbering")]
    pub continue_numbering: Option<String>,
//     #[serde(rename = "@text:continue-list")]
    #[serde(rename = "@continue-list")]
    pub continue_list: Option<String>,

//     #[serde(rename = "@text:style-name")]
    #[serde(rename = "@style-name")]
    pub style_name: Option<String>
}

// #[derive(Debug, Serialize, Deserialize, PartialEq)]
// // #[serde(untagged)]
// pub struct Unknown {
// }

#[derive(Debug, Serialize, Deserialize, PartialEq)]
// #[serde(skip_serializing_if = "Option::is_none")]
// #[serde(untagged)]
pub enum OfficeTextItem {
//     #[serde(rename = "text:p")]
    #[serde(rename = "p")]
    TextParagraph(TextParagraph),

//     #[serde(rename = "table:table")]
    #[serde(rename = "table")]
    TableTable(TableTable),

//     #[serde(rename = "text:list")]
    #[serde(rename = "list")]
    TextList(TextList),

//     #[serde(rename = "text:table-of-content")]
    #[serde(rename = "table-of-content")]
    TableOfContent(TableOfContent),

    #[serde(other)]
    Unknown
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TextProperty {
//     #[serde(rename = "@style:font-name")]
    #[serde(rename = "@font-name")]
    pub font_name: Option<String>, // 'Courier New' | 'Arial'
//     #[serde(rename = "@fo:font-weight")]
    #[serde(rename = "@font-weight")]
    pub font_weight: Option<String>, // 'bold'
//     #[serde(rename = "@fo:font-style")]
    #[serde(rename = "@font-style")]
    pub font_style: Option<String>, // 'italic'
//     #[serde(rename = "@style:text-underline-style")]
    #[serde(rename = "@text-underline-style")]
    pub underline_style: Option<String>, // 'solid'
//     #[serde(rename = "@fo:font-size")]
    #[serde(rename = "@font-size")]
    pub font_size: Option<String>,
//     #[serde(rename = "@fo:color")]
    #[serde(rename = "@color")]
    pub font_color: Option<String>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct GraphicProperty {
//     #[serde(rename = "@svg:stroke-color")]
    #[serde(rename = "@stroke-color")]
    pub stroke_color: Option<String>,
//     #[serde(rename = "@svg:stroke-width")]
    #[serde(rename = "@stroke-width")]
    pub stroke_width: Option<String>,
//     #[serde(rename = "@draw:stroke-linejoin")]
    #[serde(rename = "@stroke-linejoin")]
    pub stroke_linejoin: Option<String>,
//     #[serde(rename = "@draw:stroke")]
    #[serde(rename = "@stroke")]
    pub stroke: Option<String>,
//     #[serde(rename = "@draw:fill")]
    #[serde(rename = "@fill")]
    pub fill: Option<String>,
//     #[serde(rename = "@draw:fill-color")]
    #[serde(rename = "@fill-color")]
    pub fill_color: Option<String>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct ParagraphProperty {
//     #[serde(rename = "@fo:break-before")]
    #[serde(rename = "@break-before")]
    pub break_before: Option<String>, // 'auto'
//     #[serde(rename = "@fo:break-after")]
    #[serde(rename = "@break-after")]
    pub break_after: Option<String>, // 'auto'
//     #[serde(rename = "@fo:margin-left")]
    #[serde(rename = "@margin-left")]
    pub margin_left: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct OfficeText {
    #[serde(default)]
    #[serde(rename = "$value")]
    pub list: Vec<OfficeTextItem>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct Body {
//     #[serde(rename = "office:text")]
    #[serde(rename = "text")]
//     pub list: Vec<OfficeTextItem>,
    pub text: OfficeText,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct Style {
//     #[serde(rename = "@style:name")]
    #[serde(rename = "@name")]
    pub name: Option<String>,

//     #[serde(rename = "@style:list-style-name")]
    #[serde(rename = "@list-style-name")]
    pub list_style_name: Option<String>,

//     #[serde(rename = "@style:parent-style-name")]
    #[serde(rename = "@parent-style-name")]
    pub parent_style_name: Option<String>,

//     #[serde(rename = "style:text-properties")]
    #[serde(rename = "text-properties")]
    pub text_properties: Option<TextProperty>,

//     #[serde(rename = "style:paragraph-properties")]
    #[serde(rename = "paragraph-properties")]
    pub paragraph_properties: Option<ParagraphProperty>,

//     #[serde(rename = "style:graphic-properties")]
    #[serde(rename = "graphic-properties")]
    pub graphic_properties: Option<GraphicProperty>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct AutomaticStyle {
//     #[serde(rename = "style:style")]
    #[serde(default)]
    #[serde(rename = "style")]
    pub styles: Vec<Style>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DocumentContent {
//     #[serde(rename = "{urn:oasis:names:tc:opendocument:xmlns:office:1.0}body")]
//     #[serde(rename = "office:body")]
    #[serde(rename = "body")]
    pub body: Body,

//     #[serde(rename = "office:font-face-decls")]
    #[serde(rename = "font-face-decls")]
    pub font_face_decls: Vec<FontFaceDecl>,

//     #[serde(rename = "office:automatic-styles")]
    #[serde(rename = "automatic-styles")]
    pub automatic_styles: AutomaticStyle,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct ListLevelStyleBullet {
//     #[serde(rename = "@text:level")]
    #[serde(rename = "@level")]
    pub level: u32
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct ListLevelStyleNumber {
//     #[serde(rename = "@text:level")]
    #[serde(rename = "@level")]
    pub level: u32,
//     #[serde(rename = "@text:start-value")]
    #[serde(rename = "@start-value")]
    pub start_value: Option<u32>,
//     #[serde(rename = "@style:num-format")]
    #[serde(rename = "@num-format")]
    pub num_format: String // = 1
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct ListStyle {
//     #[serde(rename = "@style:name")]
    #[serde(rename = "@name")]
    pub name: Option<String>,
//     #[serde(rename = "text:list-level-style-bullet")]

    #[serde(default)]
    #[serde(rename = "list-level-style-bullet")]
    pub list_level_style_bullet: Vec<ListLevelStyleBullet>,
//     #[serde(rename = "text:list-level-style-number")]

    #[serde(default)]
    #[serde(rename = "list-level-style-number")]
    pub list_level_style_number: Vec<ListLevelStyleNumber>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct OfficeStyles {
//     #[serde(rename = "text:list-style")]
    #[serde(default)]
    #[serde(rename = "list-style")]
    pub list_styles: Vec<ListStyle>,

//     #[serde(rename = "style:style")]
    #[serde(default)]
    #[serde(rename = "style")]
    pub styles: Vec<Style>
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename = "office:document-styles")]
pub struct DocumentStyles {
//     #[serde(rename = "office:styles")]
    #[serde(rename = "styles")]
    pub styles: OfficeStyles
}
