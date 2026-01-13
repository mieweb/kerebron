#!/bin/bash

rm public/examples-frame/browser-* || /bin/true

for d in ../browser-*
do
  name=$( echo $d | sed -e 's#^../##' )
  [ -d "../$name/dist" ] && ln -s "../../../$name/dist" "public/examples-frame/$name"
done
