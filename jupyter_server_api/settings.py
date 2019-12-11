flask_settings = {
    'FLASK_DEBUG': False,
    'FLASK_SERVER_NAME': 'localhost:5000'
}

flask_restplus_settings = {
    'RESTPLUS_SWAGGER_UI_DOC_EXPANSION': 'list',
    'RESTPLUS_VALIDATE': True,
    'RESTPLUS_MASK_SWAGGER': False,
    'RESTPLUS_ERROR_404_HELP': False
}

app_config = {}
app_config.update(flask_settings)
app_config.update(flask_restplus_settings)
