const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    tankGame: './games/tank-game/src/index.js',
    neonRacer: './games/neon-racer/src/index.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  devtool: 'inline-source-map',
  devServer: {
    static: './dist',
    hot: true,
    port: 8080
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(glsl|vs|fs|vert|frag)$/,
        type: 'asset/source'
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'tank-game.html',
      template: './games/tank-game/index.html',
      chunks: ['tankGame']
    }),
    new HtmlWebpackPlugin({
      filename: 'neon-racer.html',
      template: './games/neon-racer/index.html',
      chunks: ['neonRacer']
    })
  ]
};