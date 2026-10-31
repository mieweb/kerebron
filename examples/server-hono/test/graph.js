import { display } from 'https://deno.land/x/display@v0.1.1/mod.ts';

import pl from 'npm:nodejs-polars';
import * as Plot from 'npm:@observablehq/plot';
import { DOMParser, SVGElement } from 'npm:linkedom';
const document = new DOMParser().parseFromString(
  `<!DOCTYPE html><html lang="en"></html>`,
  'text/html',
);

let data =
  'Date,Income,Expenses\n2022-01-01,281,218\n2022-01-02,328,244\n2022-01-03,266,223\n2022-01-04,287,226\n';
let df = pl.readCSV(data, { sep: ',' });
const records = df.toRecords();

await display(df.sample(df.height));

await display(
  Plot.plot({
    x: { type: 'band' },
    y: { grid: true },
    marks: [
      Plot.line(records, { x: 'Date', y: 'Income', stroke: 'steelblue' }),
      Plot.line(records, { x: 'Date', y: 'Expenses', stroke: 'tomato' }),
    ],
    document,
  }),
);
