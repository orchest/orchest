import pyinotify
import os
import sys
import subprocess

def fix_path_permission(path, is_dir):

    if is_dir:
        subprocess.Popen("chmod o+rwx " + path, shell=True)
    else:
        subprocess.Popen("chmod o+rw " + path, shell=True)


def walk_dir(path):

    for dp, dirs, files in os.walk(path):
        for f in files:
            current_path = os.path.join(dp, f)
            fix_path_permission(current_path, os.path.isdir(current_path))
        for d in dirs:
            current_path = os.path.join(dp, d)
            fix_path_permission(current_path, os.path.isdir(current_path))


def initialize_permission_watcher(watch_dir):

    walk_dir(watch_dir)

    wm = pyinotify.WatchManager()
    mask = pyinotify.IN_CREATE | pyinotify.IN_MODIFY

    class EventHandler(pyinotify.ProcessEvent):

        def process_IN_CREATE(self, event):
            print("Creating: ", event.pathname)
            walk_dir(watch_dir)

        def process_IN_MODIFY(self, event):
            print("Modified: ", event.pathname)
            walk_dir(watch_dir)


    handler = EventHandler()
    notifier = pyinotify.Notifier(wm, handler)
    wm.add_watch(watch_dir, mask, rec=True)

    notifier.loop()


if __name__ == "__main__":

    if len(sys.argv) < 2:
        raise Exception("No directory specified")

    initialize_permission_watcher(sys.argv[1])