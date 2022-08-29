# Configuration file for the Sphinx documentation builder.
#
# This file only contains a selection of the most common options. For a
# full list see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Path setup -------------------------------------------------------

# If extensions (or modules to document with autodoc) are in another
# directory, add these directories to sys.path here. If the directory
# is relative to the documentation root, use os.path.abspath to make it
# absolute, like shown here.
#
import os
import sys

sys.path.insert(0, os.path.abspath("../../orchest-sdk/python"))


# -- Project information ----------------------------------------------

project = "Orchest"
copyright = "2022, Orchest Software B.V."
author = "Orchest team"

# The full version, including alpha/beta/rc tags
# We exclude the exact release because that is error prone when having
# to update it on every release.
# release = "0.3.0"
version = "beta"
html_title = "Orchest documentation"


# -- General configuration --------------------------------------------

master_doc = "index"

# Add any Sphinx extension module names here, as strings. They can be
# extensions coming with Sphinx (named 'sphinx.ext.*') or your custom
# ones.
extensions = [
    "myst_parser",
    "sphinx.ext.autodoc",
    "sphinx.ext.napoleon",
    "sphinx_design",
    "versionwarning.extension",
]

versionwarning_body_selector = 'div.content[role="main"]'
versionwarning_messages = {
    "latest": (
        'You are reading the "latest" documentation, '
        "which corresponds to an unreleased version of Orchest. "
        'Consider browsing the <a href="/en/stable/">stable</a> documentation instead.'
    ),
}


myst_enable_extensions = [
    "deflist",
]

# Add any paths that contain templates here, relative to this dir.
templates_path = ["_templates"]

# List of patterns, relative to source directory, that match files and
# directories to ignore when looking for source files.
# This pattern also affects html_static_path and html_extra_path.
exclude_patterns = [""]

# Autodoc configurations.
# Mock dependencies that are not available at build time.
autodoc_mock_imports = ["boto3", "pyarrow", "sqlalchemy"]
# The first line of the docstring can be considered to be the
# function's signature (if it looks like one).
autodoc_docstring_signature = True


# -- Options for HTML output ------------------------------------------

# The theme to use for HTML and HTML Help pages.  See the documentation
# for a list of builtin themes.
html_theme = "pydata_sphinx_theme"
html_theme_options = {
    "external_links": [
        {"url": "https://orchest.io", "name": "Website"},
    ],
    "navbar_align": "left",
    "page_sidebar_items": ["page-toc", "edit-this-page", "sourcelink"],
    "navbar_center": ["navbar-nav"],
    "navbar_end": ["theme-switcher", "navbar-icon-links.html", "search-field.html"],
    "show_toc_level": 1,
    "github_url": "https://github.com/orchest/orchest",
    "twitter_url": "https://twitter.com/orchestofficial",
    "logo": {
        "image_light": "img/logo-light.png",
        "image_dark": "img/logo-dark.png",
    },
}

html_sidebars = {
    "development/index": ["sidebar-nav-bs"],
    "fundamentals/index": ["sidebar-nav-bs"],
    "getting_started/index": ["sidebar-nav-bs"],
    "reference/index": ["sidebar-nav-bs"],
    "index": [],
}


# Add any paths that contain custom static files (such as style sheets)
# here, relative to this directory. They are copied after the builtin
# static files, so a file named "default.css" will overwrite the
# builtin "default.css".
html_static_path = ["_static"]

html_css_files = [
    "https://cdn.jsdelivr.net/npm/@docsearch/css@alpha",
    "css/custom_styles.css",
    "css/installer_widget.css",
    "css/rate_widget.css",
]

html_js_files = [
    "https://cdn.jsdelivr.net/npm/@docsearch/js@alpha",
    "js/installer_widget.js",
    "js/rate_widget.js",
    "js/algolia.js",
]
