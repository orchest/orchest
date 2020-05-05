# This bash script can be used to develop the Python SDK
# it copies the sdk files to a pipeline directory to make it possible to install a local Python package like `pip install -e .tmp-orchest-sdk/orchest`

import os


PIPELINE_UUID = "05d7cc70-eed8-48d3-9cab-8639789fb8ad"
SDK_DIR = "orchest/orchest-sdk/python/src/orchest/"
SDK_TARGET_DIR = "orchest/userdir/pipelines/" + PIPELINE_UUID + "/orchest/"

import pyinotify

wm = pyinotify.WatchManager()
mask = pyinotify.IN_DELETE | pyinotify.IN_CREATE | pyinotify.IN_MODIFY

class EventHandler(pyinotify.ProcessEvent):

    def process_IN_CREATE(self, event):
        print("Creating: ", event.pathname)

    def process_IN_DELETE(self, event):
        print("Removing: ", event.pathname)

    def process_IN_MODIFY(self, event):
        print("Modified: ", event.pathname)

        # copy SDK on write
        os.system("rm -rf " + SDK_TARGET_DIR)
        os.system("cp -r " + SDK_DIR + " " + SDK_TARGET_DIR)


handler = EventHandler()
notifier = pyinotify.Notifier(wm, handler)
wdd = wm.add_watch(SDK_DIR, mask, rec=True)

notifier.loop()
