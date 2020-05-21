import json
import os

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
                print(e)
    except Exception as e:
        print(e)


    # always set rw permissions on file
    os.system("chmod o+rw " + conf_json_path)