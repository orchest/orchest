from connections import db


class Launch(db.Model):
    __tablename__ = 'launches'
    pipeline_uuid = db.Column(db.String(36), primary_key=True)
    server_ip = db.Column(db.String(15), unique=True, nullable=False)  # IPv4
    server_info = db.Column(db.JSON, unique=True, nullable=False)

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    def __repr__(self):
        return f'<Launch {self.pipeline_uuid}>'
