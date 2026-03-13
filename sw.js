const CACHE_NAME = 'yaoxi-home-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './main.js',
  './home.mp4',
  './avatar.jpg',
  './favicon.jpg',
  './music.mp3',
  './mobile-bg.jpg'
];

// 安装事件：预缓存关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // 立即激活，跳过等待
  self.skipWaiting();
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  // 立即接管所有页面
  self.clients.claim();
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  // 对于视频文件，使用特殊处理（优先缓存，支持断点续传的简化版）
  // 注意：完整的 Range 请求支持在 SW 中比较复杂，
  // 这里使用简单的缓存优先策略，适用于中小型视频
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 如果缓存中有，直接返回
      if (response) {
        return response;
      }

      // 否则发起网络请求
      return fetch(event.request).then((networkResponse) => {
        // 检查响应是否有效
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // 这是一个流响应，我们需要克隆它
        // 因为响应流只能被消耗一次
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          // 将新资源放入缓存
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
