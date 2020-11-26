var webpack = require("webpack");
const isDevelopment = process.env.NODE_ENV === "development";
var CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

var path = require("path");

var server_static_path = path.resolve(__dirname, "../wdb_server/static");
var server_static_image_path = path.resolve(server_static_path, "images");
var server_static_libs_path = path.resolve(server_static_path, "libs");
var server_static_mdl_path = path.resolve(
    server_static_libs_path,
    "material-design-lite"
);

module.exports = {
    mode: "development",
    entry: {
        home: ["./src/_compat.ts", "./src/_base.ts", "./src/home.ts"],
        wdb: [
            "./src/_compat.ts",
            "./src/_base.ts",
            "./src/_websocket.ts",
            "./src/_source.ts",
            "./src/_history.ts",
            "./src/_traceback.ts",
            "./src/_interpreter.ts",
            "./src/_prompt.ts",
            "./src/_watchers.ts",
            "./src/_switch.ts",
            "./src/_help.ts",
            "./src/wdb.ts",
        ],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: "ts-loader",
                    options: {
                        silent: true,
                    },
                },
                exclude: /node_modules/,
            },
            {
                test: /\.s(a|c)ss$/i,
                use: [
                    // Creates `style` nodes from JS strings
                    "style-loader",
                    // Translates CSS into CommonJS
                    "css-loader",
                    // Compiles Sass to CSS
                    "sass-loader",
                ],
            },
            {
                test: /\.css$/,
                use: [
                    "style-loader",
                    {
                        loader: "css-loader",
                        options: {
                            importLoaders: 1,
                            modules: true,
                        },
                    },
                ],
                include: /\.module\.css$/,
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
                exclude: /\.module\.css$/,
            },
            {
                test: /\.(jpe?g|png|gif|svg|eot|woff|ttf|svg|woff2)$/,
                use: "file-loader",
            },
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js", ".scss"],
    },
    output: {
        filename: "[name].js",
        path: path.resolve(server_static_path, "javascripts/dist"),
    },
    plugins: [
        new webpack.ProvidePlugin({
            $: "jquery",
            jQuery: "jquery",
            "window.jQuery": "jquery",
        }),
        new MiniCssExtractPlugin({
            filename: isDevelopment ? "[name].css" : "[name].[hash].css",
            chunkFilename: isDevelopment ? "[id].css" : "[id].[hash].css",
        }),
        new CopyWebpackPlugin({
            patterns: [
                // relative path is from src
                {
                    from: "./src/assets/images/favicon.ico",
                    to: path.resolve(server_static_image_path, "favicon.ico"),
                },
                // mdl css themes
                {
                    from:
                        "./node_modules/material-design-lite/dist/material.*-*.min.css",
                    to: path.resolve(server_static_mdl_path, "[name].css"),
                },
            ],
            options: {
                concurrency: 100,
            },
        }),
    ],
};
