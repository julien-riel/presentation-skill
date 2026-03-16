import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import type { Presentation } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

let templateInfo: TemplateInfo;
beforeAll(async () => {
  templateInfo = await readTemplate(TEMPLATE_PATH);
});

describe('kpiDrawer', () => {
  it('renders KPI indicator cards with values and labels', async () => {
    const presentation: Presentation = {
      title: 'KPI Test',
      slides: [
        {
          layout: 'kpi',
          _resolvedLayout: 'kpi',
          elements: [
            { type: 'title', text: 'Key Metrics' },
            {
              type: 'kpi',
              indicators: [
                { label: 'Revenue', value: '$1.2M', unit: 'USD' },
                { label: 'Users', value: '50K' },
                { label: 'NPS', value: '72', unit: 'pts' },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('Key Metrics');
    expect(slideXml).toContain('$1.2M');
    expect(slideXml).toContain('Revenue');
    expect(slideXml).toContain('50K');
    expect(slideXml).toContain('Users');
    expect(slideXml).toContain('72');
    expect(slideXml).toContain('NPS');
    expect(slideXml).toContain('USD');
    expect(slideXml).toContain('pts');
    // KPI cards use rounded rectangles
    expect(slideXml).toContain('prstGeom prst="roundRect"');
  });

  it('emits trend icon requests', async () => {
    const presentation: Presentation = {
      title: 'KPI Trend Test',
      slides: [
        {
          layout: 'kpi',
          _resolvedLayout: 'kpi',
          elements: [
            { type: 'title', text: 'Trending KPIs' },
            {
              type: 'kpi',
              indicators: [
                { label: 'Revenue', value: '$1.2M', trend: 'up' },
                { label: 'Churn', value: '3%', trend: 'down' },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    // Should contain p:pic elements for trend icons
    expect(slideXml).toContain('<p:pic>');

    // Should have image files in ppt/media/
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  it('renders custom indicator icons', async () => {
    const presentation: Presentation = {
      title: 'KPI Icon Test',
      slides: [
        {
          layout: 'kpi',
          _resolvedLayout: 'kpi',
          elements: [
            { type: 'title', text: 'Icon KPIs' },
            {
              type: 'kpi',
              indicators: [
                { label: 'Users', value: '50K', icon: 'users' },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    // Should contain p:pic element for custom icon
    expect(slideXml).toContain('<p:pic>');

    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  it('handles empty indicators gracefully', async () => {
    const presentation: Presentation = {
      title: 'Empty KPI Test',
      slides: [
        {
          layout: 'kpi',
          _resolvedLayout: 'kpi',
          elements: [
            { type: 'title', text: 'No KPIs' },
            {
              type: 'kpi',
              indicators: [],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();
    expect(slideXml).toContain('No KPIs');
    // No rounded rects should be generated for empty indicators
    expect(slideXml).not.toContain('prstGeom prst="roundRect"');
  });

  it('renders up to 6 indicators', async () => {
    const presentation: Presentation = {
      title: 'Many KPI Test',
      slides: [
        {
          layout: 'kpi',
          _resolvedLayout: 'kpi',
          elements: [
            { type: 'title', text: 'Six KPIs' },
            {
              type: 'kpi',
              indicators: [
                { label: 'KPI-1', value: '10' },
                { label: 'KPI-2', value: '20' },
                { label: 'KPI-3', value: '30' },
                { label: 'KPI-4', value: '40' },
                { label: 'KPI-5', value: '50' },
                { label: 'KPI-6', value: '60' },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('KPI-1');
    expect(slideXml).toContain('KPI-6');
    expect(slideXml).toContain('10');
    expect(slideXml).toContain('60');
  });
});
