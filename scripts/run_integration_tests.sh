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
          echo -e "-a            Auto confirm.\033[0;31m Don't use this unless you know" \
            "what you are doing: running the integration tests deletes all contents" \
            'of the "data and "userdir/projects" directories, along with all' \
            "environments.\033[0m"
          echo "-g            Run cypress in GUI mode."
          echo '--            Everything after "--" will be passed to the Cypress CLI.' \
          '"--browser chrome" is passed by default.'
          exit 0
      fi
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

shift $(($OPTIND - 1))
cypress_args="$@"


echo -e "The integration tests require Orchest to be installed, along with Chrome." \
  "The tests have been run with Chrome 88, other versions are not guaranteed to" \
  "work. If Orchest is running, it is expected to run on port 8000. If not running," \
  "the tests will take care of starting it."
echo -e '\033[0;31mRunning the integration tests will delete all content of the' \
	'"data" and "userdir/projects" directories, and you will lose all built' \
  'environments.\033[0m'


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
echo "Making sure Orchest is running..."
orchest status || orchest start || (echo "Could not start Orchest." && exit 1)

echo -e "Removing all environment images..."
[ ! -z "$(docker images --filter 'label=_orchest_env_build_task_uuid' -q)" ] && docker rmi -f $(docker images --filter "label=_orchest_env_build_task_uuid" -q) > /dev/null

cd "${DIR}/../cypress"

if [ $MODE == "cli" ]; then
	pnpm run --filter '@orchest/cypress' cy:run -- test --browser $BROWSER $cypress_args
else
	pnpm run --filter '@orchest/cypress' cy:open -- --config watchForFileChanges=false $cypress_args
fi