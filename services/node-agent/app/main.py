import logging
import asyncio
import argparse

from image_puller import *

if __name__ == '__main__':

    logger = logging.getLogger('node_agent')
    logger.setLevel("INFO")

    logger.info("Starting node_agent.")

    parser = argparse.ArgumentParser()
    parser.add_argument('--image-puller-log-level', dest='image_puller_log_level', nargs='?',
                        help='Specifies log level, default "INFO".', default="INFO")
    parser.add_argument('--image-puller-interval', dest='image_puller_interval', nargs='?',
                        help='Specifies image puller interval in sec, default 60 sec.', default=60, type=int)
    parser.add_argument('--image-puller-policy', dest='image_puller_policy', nargs='?',
                        help='Specifies image puller policy. default "IfNotPresent".', default="IfNotPresent")
    parser.add_argument('--image-puller-retries', dest='image_puller_retries', nargs='?',
                        help='Specifies image puller number of retries. default 3.', default=3, type=int)
    parser.add_argument('--image-puller-images', dest='image_puller_images', nargs='+',
                        help='Specifies image puller number of retries.')

    arguments = vars(parser.parse_args())
    image_puller_log_level = arguments['image_puller_log_level']
    image_puller_interval = arguments['image_puller_interval']
    image_puller_policy = arguments['image_puller_policy']
    image_puller_retries = arguments['image_puller_retries']
    image_puller_images = arguments['image_puller_images']

    image_puller = ImagePuller(image_puller_interval,
                               image_puller_policy,
                               image_puller_retries,
                               image_puller_images,
                               image_puller_log_level)

    loop = asyncio.get_event_loop()
    loop.create_task(image_puller.run())
    loop.run_forever()

    logger.info("Stopping node_agent.")
