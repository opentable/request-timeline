#!/bin/sh
set -o nounset -o errexit

git pull -q
/usr/bin/env bower update -p -q
