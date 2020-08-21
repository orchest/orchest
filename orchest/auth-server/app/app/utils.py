import hashlib
import json
import logging
import sys


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
            config = json.load(f)

        conf_data.update(config)
    except Exception as e:
        logging.debug(e)

    return conf_data
