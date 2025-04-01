const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlInlineScriptPlugin = require("html-inline-script-webpack-plugin");

module.exports = {
  mode: "production",
  entry: "./src/bitsy.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /libgif\/.*\.js$|game_element\.js$/,
        use: ["script-loader"],
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: "asset/inline",
      },
      {
        test: /\.(mp3|ogg|wav)$/i,
        type: "asset/inline",
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      filename: "index.html",
      templateContent: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Bitsy</title>
          </head>
          <body>
            <canvas id="gameCanvas"></canvas>
          </body>
        </html>
      `,
      inject: "body",
    }),
    new HtmlInlineScriptPlugin(),
  ],
};
