# pylint: disable=all
# Stdlib:
import pathlib
import sys
from typing import List

# Thirdparty:
from setuptools import find_packages, setup

__version__ = "1.0.0-dev0"
PARENT = pathlib.Path(__file__).parent


def read_requirements(path: str) -> List[str]:
    file_path = PARENT / path
    requires = []
    with open(file_path) as f:
        requires = f.read().split("\n")
    # requires += [f"wdb=={__version__}"]
    if sys.platform == "linux":
        requires += ["pyinotify"]
    return requires


options = dict(
    name="wdb.server.aiohttp",
    version=__version__,
    description="An improbable web debugger through WebSockets (server)",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="Shepilov Vladislav",
    author_email="shepilov.v@protonmail.com",
    url="https://github.com/shepilov-vladislav/wdb_server_aiohttp",
    license="GPLv3",
    platforms="Any",
    scripts=["wdb.server.py"],
    packages=find_packages(),
    install_requires=read_requirements("requirements/production.txt"),
    package_data={
        "wdb_server": [
            "static/*",
            "templates/*.html",
            "requirements/*",
        ]
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: GNU Lesser General Public License v3 or later (LGPLv3+)",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: Implementation :: CPython",
        "Topic :: Software Development :: Debuggers",
    ],
    include_package_data=True,
    zip_safe=False,
)

setup(**options)
