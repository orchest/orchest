"""Performs a cleanup of Orchest controlled resources.

This is used to ensure that on Orchest start and stop the system
remains in a consistent state and without dangling resources like pods
or sessions.
"""
from app import cleanup

if __name__ == "__main__":
    cleanup()
