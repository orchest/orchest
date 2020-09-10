import json
import os
import hashlib
import random
import string
import logging
import uuid
import tarfile
import io

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


def tar_from_path(path, filename):

    tmp_file_path = os.path.join("/tmp", str(uuid.uuid4()))
    tar = tarfile.open(tmp_file_path, "x")

    with open(path, "rb") as f:

        info = tarfile.TarInfo(filename)

        f.seek(0, io.SEEK_END)
        info.size = f.tell()
        f.seek(0, io.SEEK_SET)

        tar.addfile(info, f)
        tar.close()

    with open(tmp_file_path, "rb") as in_file:
        data = in_file.read()

    # remove tmp file
    os.remove(tmp_file_path)

    return data


def name_to_tag(name):

    name = str(name)

    # According to Docker's website:
    # A tag name must be valid ASCII and 
    # may contain lowercase and 
    # uppercase letters, digits, underscores, periods and dashes. 
    # A tag name may not start with a period or a dash and
    # may contain a maximum of 128 characters.

    # replace all spaces by dashes
    name = name.replace(" ", "-")

    allowed_symbols = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-")
    
    name = ''.join([char if char in allowed_symbols else '-' for char in list(name)])

    while len(name) > 0 and name[0] in set('.-'):
        name = name[1:]

    return name[0:128]


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