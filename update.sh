#!/bin/sh
set -o nounset -o errexit

PATH=$PATH:/usr/local/bin

git pull -q
/usr/bin/env bower update -p -q
