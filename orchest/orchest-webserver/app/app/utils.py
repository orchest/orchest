import json

def write_config(app, key, value):

    try:
        conf_json_path = "/config/config.json"

        with open(conf_json_path, 'r') as f:
            conf_data = json.load(f)
            
            conf_data[key] = value
            
            app.config.update(conf_data)

            try:
                json.dump(conf_data, conf_json_path)
            except Exception as e:
                print(e)
    except Exception as e:
        print(e)