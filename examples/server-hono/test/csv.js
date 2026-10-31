import pl from 'npm:nodejs-polars';
import { display } from 'https://deno.land/x/display@v0.1.1/mod.ts';

let data =
  'Date,Income,Expenses\n2022-01-01,281,218\n2022-01-02,328,244\n2022-01-03,266,223\n2022-01-04,287,226\n';
let df = pl.readCSV(data, { sep: ',' });

await display(df.sample(df.height));
