# PATCH MARKER: uh9999x

import atexit


def orchest_notice():
    print(
        """
 \ \        / /             (_)
  \ \  /\  / /_ _ _ __ _ __  _ _ __   __ _
   \ \/  \/ / _` | '__| '_ \| | '_ \ / _` |
    \  /\  / (_| | |  | | | | | | | | (_| |
     \/  \/ \__,_|_|  |_| |_|_|_| |_|\__, |
                                      __/ |
                                     |___/

# Please use Orchest environments to install pip packages.
# NOTE: This only applies to installing packages inside Jupyter
# kernels, not when installing Jupyter extensions.
"""
    )


atexit.register(orchest_notice)
