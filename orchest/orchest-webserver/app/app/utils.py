import json
import os
import hashlib
import random
import string
import logging

def get_hash(path):
	BLOCKSIZE = 8192 * 8
	hasher = hashlib.md5()
	with open(path, 'rb') as afile:
	    buf = afile.read(BLOCKSIZE)
	    while len(buf) > 0:
	        hasher.update(buf)
	        buf = afile.read(BLOCKSIZE)

	return hasher.hexdigest()


def get_user_conf():
    conf_data = {}

    # configure default value
    conf_data['AUTH_ENABLED'] = False

    try:
        with open("/config/config.json", 'r') as f:
            conf_data = json.load(f)
    except Exception as e:
        logging.debug(e)

    return conf_data


def write_config(app, key, value):

    try:
        conf_json_path = "/config/config.json"

        if not os.path.isfile(conf_json_path):
            os.system("touch " + conf_json_path)

        with open(conf_json_path, 'r') as f:
            try:
                conf_data = json.load(f)
            except Exception as e:
                print("JSON read error: %s" % e)
                conf_data = {}

            conf_data[key] = value
            
            app.config.update(conf_data)
        with open(conf_json_path, 'w') as f:
            try:
                json.dump(conf_data, f)
            except Exception as e:
                logging.debug(e)
    except Exception as e:
        logging.debug(e)


    # always set rw permissions on file
    os.system("chmod o+rw " + conf_json_path)