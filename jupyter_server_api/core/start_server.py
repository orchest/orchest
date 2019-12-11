import json
import sys

from jupyterlab.labapp import LabApp


def main():
    # --no-browser
    # --ip
    # --port
    # --gateway-url
    # --notebook-dir

    sys.argv.append('--notebook-dir=/Users/yannick/Documents/projects/databoost')
    sys.argv.append('--no-browser')

    la = LabApp()
    la.initialize()

    fname = 'tmp/server_info.json'
    with open(fname, 'w') as f:
        json.dump(la.server_info(), f)

    print('Started Jupyter Notebook server')

    la.start()


if __name__ == '__main__':
    main()
