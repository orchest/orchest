import pyinotify
import os
import sys


def fix_path_permission(path):

    os.system("chmod o+rwx " + path)


def initialize_permission_watcher(watch_dir):

    wm = pyinotify.WatchManager()
    mask = pyinotify.IN_CREATE | pyinotify.IN_MODIFY

    class EventHandler(pyinotify.ProcessEvent):

        def process_IN_CREATE(self, event):
            print("Creating: ", event.pathname)
            fix_path_permission(event.pathname)

        def process_IN_MODIFY(self, event):
            print("Modified: ", event.pathname)
            fix_path_permission(event.pathname)

    handler = EventHandler()
    notifier = pyinotify.Notifier(wm, handler)
    wm.add_watch(watch_dir, mask, rec=True)

    notifier.loop()


if __name__ == "__main__":

    if len(sys.argv) < 2:
        raise Exception("No directory specified")

    initialize_permission_watcher(sys.argv[1])