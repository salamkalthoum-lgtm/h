// sw.js - Service Worker للتحديث التلقائي
const CACHE_NAME = 'ramadan-app-v1';
const DYNAMIC_CACHE = 'ramadan-dynamic-v1';
const APP_VERSION = '1.0.0';

// الملفات التي سيتم تخزينها في الكاش
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // حذف الكاش القديم
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // إرسال رسالة إلى الصفحة الرئيسية لإعلامها بتفعيل الـ Service Worker
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: APP_VERSION
          });
        });
      });
    })
    .then(() => self.clients.claim())
  );
});

// اعتراض الطلبات
self.addEventListener('fetch', event => {
  // تجاهل طلبات POST وطلبات الملفات الأخرى غير GET
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // إذا كان الملف في الكاش، استخدمه
        if (cachedResponse) {
          // جلب النسخة المحدثة من الإنترنت في الخلفية
          fetchAndCache(event.request);
          return cachedResponse;
        }
        
        // إذا لم يكن في الكاش، جلب من الإنترنت ثم خزن في الكاش
        return fetchAndCache(event.request);
      })
      .catch(error => {
        console.error('[Service Worker] Fetch failed:', error);
        // يمكن إظهار صفحة خطأ مخصصة هنا
      })
  );
});

// دالة لجلب وتخزين الملفات
function fetchAndCache(request) {
  return fetch(request)
    .then(response => {
      // التحقق من صحة الاستجابة
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }
      
      // استنساخ الاستجابة
      const responseToCache = response.clone();
      
      // فتح الكاش الديناميكي وتخزين الاستجابة
      caches.open(DYNAMIC_CACHE)
        .then(cache => {
          cache.put(request, responseToCache);
        });
      
      return response;
    });
}

// استقبال الرسائل من الصفحة الرئيسية
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    checkForUpdate();
  }
});

// دالة للتحقق من وجود تحديثات
function checkForUpdate() {
  console.log('[Service Worker] Checking for updates...');
  
  // التحقق من ملف manifest أو ملف إصدار للمقارنة
  fetch('./?v=' + Date.now(), { cache: 'no-store' })
    .then(response => response.text())
    .then(html => {
      // استخراج إصدار الموقع من التعليق المحدد
      const versionMatch = html.match(/<!-- APP_VERSION:(\d+\.\d+\.\d+) -->/);
      const newVersion = versionMatch ? versionMatch[1] : APP_VERSION;
      
      if (newVersion !== APP_VERSION) {
        // إرسال إشعار بوجود تحديث جديد
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'UPDATE_AVAILABLE',
              newVersion: newVersion,
              currentVersion: APP_VERSION
            });
          });
        });
      }
    })
    .catch(error => {
      console.error('[Service Worker] Update check failed:', error);
    });
}

// التحقق من التحديثات بشكل دوري
self.addEventListener('sync', event => {
  if (event.tag === 'check-update') {
    event.waitUntil(checkForUpdate());
  }
});

// التحقق من التحديثات عند اتصال الإنترنت
self.addEventListener('online', () => {
  checkForUpdate();
});
