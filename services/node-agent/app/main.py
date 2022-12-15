import argparse
import asyncio
import logging

from image_deleter import run as image_deleter_run
from image_puller import ImagePuller, Policy
from image_pusher import run as image_pusher_run

if __name__ == "__main__":

    logging.basicConfig(level=logging.DEBUG)

    logger = logging.getLogger("NODE_AGENT")

    logger.info("Starting node_agent.")

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--image-puller-log-level",
        dest="image_puller_log_level",
        nargs="?",
        help='Specifies log level, default "INFO".',
        default="INFO",
    )
    parser.add_argument(
        "--image-puller-interval",
        dest="image_puller_interval",
        nargs="?",
        help="Specifies image puller interval in sec, default 5 sec.",
        default=5,
        type=int,
    )
    parser.add_argument(
        "--image-puller-policy",
        dest="image_puller_policy",
        nargs="?",
        help='Specifies image puller policy. default "IfNotPresent".',
        default=Policy.IfNotPresent,
        type=Policy,
    )
    parser.add_argument(
        "--image-puller-retries",
        dest="image_puller_retries",
        nargs="?",
        help="Specifies image puller number of retries. default 3.",
        default=3,
        type=int,
    )
    parser.add_argument(
        "--image-puller-threadiness",
        dest="image_puller_threadiness",
        nargs="?",
        help="Specifies number of async pullers, default 4.",
        default=4,
        type=int,
    )
    parser.add_argument(
        "--orchest-api-host",
        dest="orchest_api_host",
        nargs="?",
        help="The the orchest api host. default http://orchest-api:80",
        default="http://orchest-api:80",
    )

    arguments = vars(parser.parse_args())
    image_puller = ImagePuller(**arguments)

    async def tasks():
        await asyncio.gather(
            image_puller.run(), image_deleter_run(), image_pusher_run()
        )

    asyncio.run(tasks())

    logger.info("Stopping node_agent.")
