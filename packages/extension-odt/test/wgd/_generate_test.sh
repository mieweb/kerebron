#!/bin/bash

for odt_file in *.odt; do
  base_name=$(basename "$odt_file" .odt)
  test_ts_file="${base_name}.test.ts"

  if [[ -f "$test_ts_file" ]]; then
    echo "Skipping $test_ts_file, it already exists."
  else
    echo "import { wgdTest } from './wgdTest.ts';" > "$test_ts_file"
    echo "" >> "$test_ts_file"
    echo "wgdTest('$odt_file', { debug: true });" >> "$test_ts_file"
  fi
done
