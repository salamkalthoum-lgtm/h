// sw.js - Service Worker محسن
const CACHE_NAME = 'ramadan-app-v' + new Date().getTime();
const APP_VERSION = '1.3.3';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  console.log('🚀 تثبيت Service Worker جديد');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 تخزين الملفات في الكاش');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ تم التثبيت بنجاح');
        return self.skipWaiting();
      })
  );
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  console.log('🎯 تفعيل Service Worker');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ حذف الكاش القديم: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // إرسال رسالة إلى الصفحة
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: APP_VERSION
          });
        });
      });
      
      return self.clients.claim();
    })
  );
});

// معالجة الطلبات
self.addEventListener('fetch', event => {
  // تجاهل طلبات POST
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا كان الملف في الكاش
        if (response) {
          // تحديث الكاش في الخلفية
          fetchAndCache(event.request);
          return response;
        }
        
        // جلب من الشبكة
        return fetchAndCache(event.request);
      })
      .catch(() => {
        // صفحة الخطأ
        return new Response(`
          <!DOCTYPE html>
          <html lang="ar" dir="rtl">
          <head>
              <meta charset="UTF-8">
              <title>لا يوجد اتصال</title>
              <style>
                  body { font-family: 'Cairo', sans-serif; text-align: center; padding: 50px; }
                  h1 { color: #8A2BE2; }
                  button { background: #8A2BE2; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
              </style>
          </head>
          <body>
              <h1>⚠️ لا يوجد اتصال بالإنترنت</h1>
              <p>الرجاء التحقق من اتصالك بالإنترنت</p>
              <button onclick="window.location.reload()">إعادة تحميل</button>
          </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      })
  );
});

// دالة الجلب والتخزين
function fetchAndCache(request) {
  return fetch(request)
    .then(response => {
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }
      
      const responseToCache = response.clone();
      
      caches.open(CACHE_NAME)
        .then(cache => {
          cache.put(request, responseToCache);
        });
      
      return response;
    });
}

// ====== نظام التحديثات ======
// استقبال الرسائل
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏩ تخطي الانتظار...');
    self.skipWaiting();
    
    // إخبار الصفحات بإعادة التحميل
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'RELOAD_PAGE' });
      });
    });
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    checkForUpdate();
  }
});

// دالة التحقق من التحديثات
function checkForUpdate() {
  console.log('🔍 التحقق من التحديثات...');
  
  fetch('./?update_check=' + Date.now(), { 
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
    .then(response => {
      if (!response.ok) throw new Error('فشل الجلب');
      return response.text();
    })
    .then(html => {
      const versionMatch = html.match(/<!-- APP_VERSION:(\d+\.\d+\.\d+) -->/);
      if (!versionMatch) return;
      
      const newVersion = versionMatch[1];
      
      if (newVersion !== APP_VERSION) {
        console.log(`🎯 نسخة جديدة: ${newVersion}`);
        
        // إرسال إشعار إلى جميع الصفحات
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'UPDATE_AVAILABLE',
              newVersion: newVersion,
              currentVersion: APP_VERSION,
              timestamp: Date.now()
            });
          });
        });
        
        // تحديث تلقائي في الخلفية
        self.skipWaiting();
      }
    })
    .catch(error => {
      console.error('❌ خطأ في التحقق:', error);
    });
}

// التحقق كل 15 دقيقة
setInterval(checkForUpdate, 15 * 60 * 1000);

// التحقق عند الاتصال بالإنترنت
self.addEventListener('online', checkForUpdate);

// ====== الإشعارات ======
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'تذكير من تطبيق يومك في رمضان',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    tag: 'ramadan-notification',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'فتح التطبيق'
      },
      {
        action: 'update',
        title: 'تحديث الآن'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'يومك في رمضان', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(clients.openWindow('/'));
  } else if (event.action === 'update') {
    // تحديث التطبيق
    self.skipWaiting();
    event.waitUntil(clients.openWindow('/?update=true'));
  }
});
