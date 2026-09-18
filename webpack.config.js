const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// Every cabinet game also gets a standalone page at /<game>.html.
const GAMES = ['tank-game', 'neon-racer', 'brick-blitz', 'star-swarm', 'neon-snake'];

module.exports = (env, argv) => ({
  mode: argv.mode || 'development',
  entry: {
    arcade: './diorama/src/index.js',
    ...Object.fromEntries(GAMES.map((game) => [game, `./games/${game}/src/standalone.js`])),
  },
  output: {
    filename: '[name].[contenthash:8].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  devtool: argv.mode === 'production' ? false : 'eval-cheap-module-source-map',
  devServer: {
    static: './dist',
    hot: true,
    host: '0.0.0.0',
    port: 8080,
    // Reachable over the local network and the tailnet (webpack rejects
    // unknown Host headers by default).
    allowedHosts: ['localhost', '127.0.0.1', '.ts.net'],
    client: {
      overlay: false,
      // Derive the live-reload socket from the page URL so it also works
      // behind a reverse proxy (e.g. `tailscale serve` on https://<host>/).
      webSocketURL: 'auto://0.0.0.0:0/ws',
    },
  },
  performance: { hints: false },
  optimization: {
    splitChunks: { chunks: 'all' },
  },
  module: {
    rules: [
      {
        test: /\.(gltf|glb|png|jpg|webp|ico|svg|webmanifest|woff2?)$/,
        type: 'asset/resource',
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['@babel/preset-env', { targets: 'defaults' }]],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: './diorama/index.html',
      chunks: ['arcade'],
    }),
    ...GAMES.map((game) => new HtmlWebpackPlugin({
      filename: `${game}.html`,
      template: './games/shared/standalone.html',
      chunks: [game],
    })),
  ],
});
