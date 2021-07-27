const withPWA = require('next-pwa');
const withVideos = require('next-videos');
const runtimeCaching = require('next-pwa/cache');

module.exports = withVideos(withPWA({
  reactStrictMode: true,
  pwa: {
    disable: process.env.NODE_ENV === 'development',
    dest: 'public',
    runtimeCaching,
  }
}))
