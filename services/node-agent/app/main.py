import argparse
import asyncio
import logging

from image_puller import ImagePuller, Policy

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
        help="Specifies image puller interval in sec, default 60 sec.",
        default=60,
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
    )
    parser.add_argument(
        "--image-puller-images",
        dest="image_puller_images",
        nargs="+",
        help="Specifies list of images to be pulled by image puller.",
    )

    arguments = vars(parser.parse_args())
    image_puller = ImagePuller(**arguments)

    asyncio.run(image_puller.run())

    logger.info("Stopping node_agent.")
