// CSS dependency
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
import "codemirror/addon/dialog/dialog.css";
import "codemirror/addon/hint/show-hint.css";

// General module
// @ts-ignore
import CodeMirror from "codemirror/lib/codemirror";

// Addons
import "codemirror/addon/runmode/runmode";
import "codemirror/addon/dialog/dialog";
import "codemirror/addon/search/searchcursor";
import "codemirror/addon/search/jump-to-line";
import "codemirror/addon/search/search";
import "codemirror/addon/hint/show-hint";
import "codemirror/addon/edit/matchbrackets";

// Syntax mode
import "codemirror/mode/python/python";
import "codemirror/mode/jinja2/jinja2";
import "codemirror/mode/diff/diff";

export { CodeMirror };
