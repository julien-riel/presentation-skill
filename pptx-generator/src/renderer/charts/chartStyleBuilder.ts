/**
 * Generates boilerplate chart style, colors, and rels XML files.
 * These are companion files that PowerPoint expects alongside each chart.
 */

/** Generates static <cs:chartStyle> XML with default style entries. */
export function buildChartStyleXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cs:chartStyle xmlns:cs="http://schemas.microsoft.com/office/drawing/2012/chartStyle" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" id="102">
  <cs:axisTitle>
    <cs:lnRef idx="0"/>
    <cs:fillRef idx="0"/>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/>
    </cs:fontRef>
    <cs:defRPr sz="1000" b="1"/>
  </cs:axisTitle>
  <cs:categoryAxis>
    <cs:lnRef idx="0"/>
    <cs:fillRef idx="0"/>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/>
    </cs:fontRef>
    <cs:defRPr sz="900"/>
  </cs:categoryAxis>
  <cs:dataPoint>
    <cs:lnRef idx="0"/>
    <cs:fillRef idx="1"><cs:styleClr val="auto"/></cs:fillRef>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/>
    </cs:fontRef>
  </cs:dataPoint>
  <cs:dataPointLine>
    <cs:lnRef idx="0"><cs:styleClr val="auto"/></cs:lnRef>
    <cs:fillRef idx="1"/>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/>
    </cs:fontRef>
    <cs:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:round/></a:ln></cs:spPr>
  </cs:dataPointLine>
  <cs:dataPointMarker>
    <cs:lnRef idx="0"><cs:styleClr val="auto"/></cs:lnRef>
    <cs:fillRef idx="1"><cs:styleClr val="auto"/></cs:fillRef>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/>
    </cs:fontRef>
    <cs:spPr><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></cs:spPr>
  </cs:dataPointMarker>
  <cs:dataPointWireframe>
    <cs:lnRef idx="0"><cs:styleClr val="auto"/></cs:lnRef>
    <cs:fillRef idx="1"/>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/>
    </cs:fontRef>
    <cs:spPr><a:ln w="9525" cap="rnd"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:round/></a:ln></cs:spPr>
  </cs:dataPointWireframe>
  <cs:gridlineMajor>
    <cs:lnRef idx="0"/>
    <cs:fillRef idx="0"/>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/>
    </cs:fontRef>
    <cs:spPr><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="15000"/><a:lumOff val="85000"/></a:schemeClr></a:solidFill><a:round/></a:ln></cs:spPr>
  </cs:gridlineMajor>
  <cs:gridlineMinor>
    <cs:lnRef idx="0"/>
    <cs:fillRef idx="0"/>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/>
    </cs:fontRef>
    <cs:spPr><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="5000"/><a:lumOff val="95000"/></a:schemeClr></a:solidFill><a:round/></a:ln></cs:spPr>
  </cs:gridlineMinor>
  <cs:valueAxis>
    <cs:lnRef idx="0"/>
    <cs:fillRef idx="0"/>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/>
    </cs:fontRef>
    <cs:defRPr sz="900"/>
  </cs:valueAxis>
</cs:chartStyle>`;
}

/** Generates static <cs:colorStyle> XML with accent1-accent6 cycle. */
export function buildChartColorsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cs:colorStyle xmlns:cs="http://schemas.microsoft.com/office/drawing/2012/chartStyle" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" meth="cycle" id="10">
  <a:schemeClr val="accent1"/>
  <a:schemeClr val="accent2"/>
  <a:schemeClr val="accent3"/>
  <a:schemeClr val="accent4"/>
  <a:schemeClr val="accent5"/>
  <a:schemeClr val="accent6"/>
  <cs:variation/>
  <cs:variation><a:lumMod val="60000"/></cs:variation>
  <cs:variation><a:lumMod val="80000"/><a:lumOff val="20000"/></cs:variation>
  <cs:variation><a:lumMod val="80000"/></cs:variation>
  <cs:variation><a:lumMod val="60000"/><a:lumOff val="40000"/></cs:variation>
  <cs:variation><a:lumMod val="50000"/></cs:variation>
  <cs:variation><a:lumMod val="70000"/><a:lumOff val="30000"/></cs:variation>
  <cs:variation><a:lumMod val="70000"/></cs:variation>
</cs:colorStyle>`;
}

/**
 * Generates chart{N}.xml.rels with relationships to style{N}.xml and colors{N}.xml.
 */
export function buildChartRelsXml(chartNum: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/office/2011/relationships/chartStyle" Target="style${chartNum}.xml"/>
  <Relationship Id="rId2" Type="http://schemas.microsoft.com/office/2011/relationships/chartColorStyle" Target="colors${chartNum}.xml"/>
</Relationships>`;
}
