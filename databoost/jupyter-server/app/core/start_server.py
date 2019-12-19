import argparse
import json
import os
import sys

from jupyterlab.labapp import LabApp


def parse_arguments():
    parser = argparse.ArgumentParser(description='Arguments for JupyterLab Server')

    parser.add_argument('--gateway-url')
    # parser.add_argument('--ip')
    # parser.add_argument('--notebook-dir')
    # parser.add_argument('--port')

    args = parser.parse_args()
    return args


def format_arguments(args):
    formatted_args = []
    for arg, value in vars(args).items():
        formatted_args.append(f'--{arg.replace("_", "-")}={value}')

    return formatted_args


def main():
    formatted_args = format_arguments(parse_arguments())

    # Add default options.
    # TODO: don't allow to run as root. But to make that work, the
    #       docker image has to be changed in order to allow another
    #       user. For now, it just works.
    formatted_args.extend(['--allow-root', '--no-browser', 
                           '--ip=0.0.0.0', '--port=8888',
                           '--notebook-dir=/notebooks'])
    sys.argv.extend(formatted_args)

    la = LabApp()
    la.initialize()

    # TODO: not sure whether abs path is the best solution here.
    abs_path = os.path.dirname(os.path.abspath(__file__))
    fname = os.path.join(abs_path, '../tmp/server_info.json')
    with open(fname, 'w') as f:
        json.dump(la.server_info(), f)

    # This print is mandatory. The message can be changed, but the
    # subprocess is piping this output to stdout to confirm that 
    # the JupyterLab has successfully started.
    print('Started Jupyter Notebook server')

    la.start()


if __name__ == '__main__':
    main()
