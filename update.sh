#!/bin/sh
set -o nounset -o errexit

PATH=$PATH:/usr/local/bin

git pull -q
/usr/bin/env bower update -p -q
/usr/bin/env npm install
/usr/bin/env npm run compile
