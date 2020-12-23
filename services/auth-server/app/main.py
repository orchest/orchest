from app import create_app
from config import CONFIG_CLASS
from app.utils import get_user_conf


conf_data = get_user_conf()

app = create_app(config_class=CONFIG_CLASS)
app.config.update(conf_data)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
