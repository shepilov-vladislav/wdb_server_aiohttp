import "material-design-icons";
import "material-design-lite";
import "material-design-icons/iconfont/material-icons.css";

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (searchString, position) {
        position = position || 0;
        return this.substr(position, searchString.length) === searchString;
    };
}
