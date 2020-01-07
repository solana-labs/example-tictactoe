/* eslint import/no-commonjs:0 */
const webpack = require('webpack');

module.exports = {
  entry: './src/webapp/index.js',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader'],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ['babel-loader', 'eslint-loader'],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['*', '.js', '.jsx'],
  },
  node: {
    fs: 'empty',
  },
  output: {
    path: __dirname + '/dist',
    publicPath: '/',
    filename: 'bundle.js',
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin({
      'process.env': {
        LIVE: JSON.stringify(process.env.LIVE),
      },
    }),
  ],
  devServer: {
    disableHostCheck: true,
    contentBase: './dist',
    hot: true,
    host: '0.0.0.0',
    historyApiFallback: {
      index: 'index.html',
    },
  },
};
