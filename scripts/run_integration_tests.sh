#!/bin/bash

# A script to launch cypress in GUI or CLI mode. Warns the user of the
# fact that integration tests will delete all content of the "data" and
# "userdir/projects" dir.

set -e

echo 'Make sure you have the required dependencies by running "pnpm i".'

MODE="cli"
BROWSER="chrome"
AUTOCONFIRM=false

while getopts ":ag-:" opt; do
  case ${opt} in
    a)
      AUTOCONFIRM=true
      ;;
    g)
      MODE="gui"
      ;;
    -)
      if [ $OPTARG == "help" ]; then
          echo "Usage:"
          echo "--help        Display help."
          echo "-a            Auto confirm."
          echo "-g            Run cypress in GUI mode."
          exit 0
      fi
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

echo -e '\033[0;31mRunning the integration tests will delete all' \
	'content of the "data" and "userdir/projects" directories.\033[0m'

if [ "$AUTOCONFIRM" = false ] ; then
	echo -e "Are you sure you want to continue?"
	msg="(y/n):"
	while true; do
		read -p "${msg}" answer
		case $answer in
			[y]* ) break;;
			[n]* ) exit;;
			* ) echo "${msg}";;
		esac
	done
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "${DIR}/../"

if [ $MODE == "cli" ]; then
	pnpm cy:run -- test --browser $BROWSER
else
	pnpm cy:open -- --config watchForFileChanges=false
fi