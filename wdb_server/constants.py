# Stdlib:
import pathlib

PROJECT_DIR = pathlib.Path(__file__).parent
MDL_THEMES_DIR = PROJECT_DIR / "static" / "libs" / "material-design-lite"
WDB_TYPES = ("home", "pm", "shell", "debug")
UUID_REGEXP = (
    "[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"
)
