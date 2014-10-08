#!/bin/sh
set -o nounset -o errexit

git pull -q
bower update -p -q
