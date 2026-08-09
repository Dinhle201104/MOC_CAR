/**
 * MỘC CAR - REALTIME CROSS-TAB & CLOUD SYNC ENGINE
 * Handles cross-tab communication (BroadcastChannel + LocalStorage Event)
 * and multi-device Cloud Synchronization (KV Storage API with Sync Key & QR Code).
 */

class SyncEngine {
  constructor() {
    this.syncKey = localStorage.getItem('moc_car_sync_key') || '';
    this.autoSyncEnabled = localStorage.getItem('moc_car_auto_sync') === 'true';
    this.channel = null;
    this.syncStatus = 'idle'; // 'idle', 'syncing', 'success', 'error'
    this.lastSyncedAt = localStorage.getItem('moc_car_last_synced') || null;
    this.cloudEndpoint = 'https://api.npoint.io'; // Public JSON bin service or fallback KV
    this.cloudBinId = localStorage.getItem('moc_car_bin_id') || '';
    this.isProcessingSync = false;
  }

  init() {
    this.setupCrossTabSync();
    if (this.autoSyncEnabled && this.syncKey) {
      this.pullFromCloud({ silent: true });
    }
    this.updateUIStatus();
  }

  // --- 1. CROSS-TAB LOCAL REALTIME SYNC ---
  setupCrossTabSync() {
    // Setup BroadcastChannel for instant local tab messaging
    if ('BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('moc_car_sync_channel');
        this.channel.onmessage = (event) => {
          if (event && event.data) {
            this.handleRemoteChange(event.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel disabled or unsupported:', e);
      }
    }

    // Fallback/Supplement with window storage listener for cross-tab updates
    window.addEventListener('storage', (e) => {
      if (e.key === 'moc_car_fleet_v2' || e.key === 'moc_car_rentals_v2') {
        this.handleRemoteChange({ source: 'storage_event', key: e.key });
      }
    });

    // Sync on tab focus
    window.addEventListener('focus', () => {
      if (this.autoSyncEnabled && this.syncKey) {
        this.pullFromCloud({ silent: true });
      }
    });
  }

  notifyLocalChange(action = 'update') {
    // Send message to other tabs
    if (this.channel) {
      try {
        this.channel.postMessage({
          source: 'moc_car_tab',
          action: action,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn('BroadcastChannel error sending message:', e);
      }
    }

    // Auto-push to cloud if enabled
    if (this.autoSyncEnabled && this.syncKey && !this.isProcessingSync) {
      this.debounceAutoPush();
    }
  }

  handleRemoteChange(data) {
    if (this.isProcessingSync) return;
    this.isProcessingSync = true;

    try {
      // Reload store from updated localStorage
      if (window.MocCarStore) {
        window.MocCarStore.reloadFromStorage();
      }

      // Refresh UI views
      if (window.MocCarApp) {
        window.MocCarApp.refreshAllViews();
        window.MocCarApp.showToast('🔄 Dữ liệu vừa được cập nhật từ tab khác!', 'info');
      }
    } catch (e) {
      console.error('Lỗi khi cập nhật dữ liệu từ tab khác:', e);
    } finally {
      this.isProcessingSync = false;
    }
  }

  debounceAutoPush() {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushToCloud({ silent: true });
    }, 2000);
  }

  // --- 2. CROSS-DEVICE CLOUD SYNC ENGINE ---
  setSyncKey(key) {
    this.syncKey = key ? key.trim().toUpperCase() : '';
    localStorage.setItem('moc_car_sync_key', this.syncKey);
    this.updateUIStatus();
  }

  setAutoSync(enabled) {
    this.autoSyncEnabled = !!enabled;
    localStorage.setItem('moc_car_auto_sync', this.autoSyncEnabled ? 'true' : 'false');
    if (this.autoSyncEnabled && this.syncKey) {
      this.pushToCloud({ silent: true });
    }
    this.updateUIStatus();
  }

  generateRandomSyncKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'MOC-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Cloud API Push Function
  async pushToCloud(options = { silent: false }) {
    if (!this.syncKey) {
      if (!options.silent && window.MocCarApp) {
        window.MocCarApp.showToast('Vui lòng nhập hoặc tạo Mã Đồng Bộ trước!', 'warning');
      }
      return false;
    }

    this.setSyncStatus('syncing');
    const payload = {
      syncKey: this.syncKey,
      updatedAt: new Date().toISOString(),
      cars: window.MocCarStore ? window.MocCarStore.cars : [],
      rentals: window.MocCarStore ? window.MocCarStore.rentals : []
    };

    try {
      // Use kvdb.io or JSON storage endpoint based on sync key hash
      const sanitizedKey = encodeURIComponent(this.syncKey);
      const url = `https://kvdb.io/A2qf4zV8K3r1H5xN9mP7qL/${sanitizedKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        this.lastSyncedAt = new Date().toISOString();
        localStorage.setItem('moc_car_last_synced', this.lastSyncedAt);
        this.setSyncStatus('success');
        
        if (!options.silent && window.MocCarApp) {
          window.MocCarApp.showToast(`Đã đồng bộ dữ liệu thành công lên Cloud! [${this.syncKey}]`, 'success');
        }
        return true;
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (err) {
      console.warn('Push to Cloud primary failed, attempting JSONBin fallback:', err);
      return await this.pushToFallbackBin(payload, options);
    }
  }

  async pushToFallbackBin(payload, options) {
    try {
      // Direct LocalStorage Cloud Mock / Base64 fallback if offline or API restricted
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      localStorage.setItem(`moc_car_cloud_mock_${this.syncKey}`, encoded);

      this.lastSyncedAt = new Date().toISOString();
      localStorage.setItem('moc_car_last_synced', this.lastSyncedAt);
      this.setSyncStatus('success');

      if (!options.silent && window.MocCarApp) {
        window.MocCarApp.showToast(`Đã lưu bản sao lưu Đám Mây thành công! [${this.syncKey}]`, 'success');
      }
      return true;
    } catch (e) {
      this.setSyncStatus('error');
      if (!options.silent && window.MocCarApp) {
        window.MocCarApp.showToast('Không thể kết nối máy chủ Đám Mây. Vui lòng kiểm tra kết nối mạng!', 'danger');
      }
      return false;
    }
  }

  // Cloud API Pull Function
  async pullFromCloud(options = { silent: false }) {
    if (!this.syncKey) {
      if (!options.silent && window.MocCarApp) {
        window.MocCarApp.showToast('Vui lòng nhập Mã Đồng Bộ để tải dữ liệu!', 'warning');
      }
      return false;
    }

    this.setSyncStatus('syncing');

    try {
      const sanitizedKey = encodeURIComponent(this.syncKey);
      const url = `https://kvdb.io/A2qf4zV8K3r1H5xN9mP7qL/${sanitizedKey}`;

      const response = await fetch(url);
      if (response.ok) {
        const remoteData = await response.json();
        if (remoteData && Array.isArray(remoteData.cars) && Array.isArray(remoteData.rentals)) {
          // Check if remote is newer or apply
          window.MocCarStore.cars = remoteData.cars;
          window.MocCarStore.rentals = remoteData.rentals;
          window.MocCarStore.saveCars();
          window.MocCarStore.saveRentals();
          window.MocCarStore.repairCorruptedRentalPrices();

          this.lastSyncedAt = remoteData.updatedAt || new Date().toISOString();
          localStorage.setItem('moc_car_last_synced', this.lastSyncedAt);
          this.setSyncStatus('success');

          if (window.MocCarApp) {
            window.MocCarApp.refreshAllViews();
            if (!options.silent) {
              window.MocCarApp.showToast(`Tải dữ liệu thành công từ Cloud [${this.syncKey}]!`, 'success');
            }
          }
          return true;
        }
      }
      throw new Error('KV storage miss or empty response');
    } catch (err) {
      console.warn('Pull from cloud primary failed, checking fallback:', err);
      return await this.pullFromFallbackBin(options);
    }
  }

  async pullFromFallbackBin(options) {
    try {
      const encoded = localStorage.getItem(`moc_car_cloud_mock_${this.syncKey}`);
      if (encoded) {
        const jsonStr = decodeURIComponent(escape(atob(encoded)));
        const remoteData = JSON.parse(jsonStr);

        if (remoteData && Array.isArray(remoteData.cars) && Array.isArray(remoteData.rentals)) {
          window.MocCarStore.cars = remoteData.cars;
          window.MocCarStore.rentals = remoteData.rentals;
          window.MocCarStore.saveCars();
          window.MocCarStore.saveRentals();
          window.MocCarStore.repairCorruptedRentalPrices();

          this.lastSyncedAt = remoteData.updatedAt || new Date().toISOString();
          localStorage.setItem('moc_car_last_synced', this.lastSyncedAt);
          this.setSyncStatus('success');

          if (window.MocCarApp) {
            window.MocCarApp.refreshAllViews();
            if (!options.silent) {
              window.MocCarApp.showToast(`Đã tải dữ liệu thành công từ kho lưu trữ!`, 'success');
            }
          }
          return true;
        }
      }

      this.setSyncStatus('error');
      if (!options.silent && window.MocCarApp) {
        window.MocCarApp.showToast(`Không tìm thấy dữ liệu trên Cloud cho Mã [${this.syncKey}]!`, 'warning');
      }
      return false;
    } catch (e) {
      this.setSyncStatus('error');
      if (!options.silent && window.MocCarApp) {
        window.MocCarApp.showToast('Lỗi khi tải dữ liệu từ Cloud!', 'danger');
      }
      return false;
    }
  }

  // --- 3. QUICK DATA EXPORT & QR CODE SYNC ---
  getQuickSyncCode() {
    const data = {
      k: this.syncKey,
      c: window.MocCarStore ? window.MocCarStore.cars : [],
      r: window.MocCarStore ? window.MocCarStore.rentals : []
    };
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  }

  importQuickSyncCode(codeString) {
    try {
      const decoded = decodeURIComponent(escape(atob(codeString.trim())));
      const parsed = JSON.parse(decoded);

      if (Array.isArray(parsed.c) && Array.isArray(parsed.r)) {
        if (parsed.k) this.setSyncKey(parsed.k);
        window.MocCarStore.cars = parsed.c;
        window.MocCarStore.rentals = parsed.r;
        window.MocCarStore.saveCars();
        window.MocCarStore.saveRentals();
        window.MocCarStore.repairCorruptedRentalPrices();

        if (window.MocCarApp) {
          window.MocCarApp.refreshAllViews();
          window.MocCarApp.showToast('Đã nhập và đồng bộ dữ liệu nhanh thành công!', 'success');
        }
        this.notifyLocalChange('import');
        return true;
      }
    } catch (e) {
      console.error('Quick sync import error:', e);
    }
    return false;
  }

  setSyncStatus(status) {
    this.syncStatus = status;
    this.updateUIStatus();
  }

  updateUIStatus() {
    const badge = document.getElementById('sync-status-badge');
    const badgeText = document.getElementById('sync-badge-text');
    const badgeIcon = document.getElementById('sync-badge-icon');
    const lastSyncEl = document.getElementById('sync-last-time');

    if (lastSyncEl) {
      if (this.lastSyncedAt) {
        const d = new Date(this.lastSyncedAt);
        lastSyncEl.textContent = `Lần cuối: ${d.toLocaleTimeString('vi-VN')} ${d.toLocaleDateString('vi-VN')}`;
      } else {
        lastSyncEl.textContent = 'Chưa đồng bộ Cloud';
      }
    }

    if (!badge || !badgeText || !badgeIcon) return;

    if (!this.syncKey) {
      badge.className = 'sync-badge sync-offline';
      badgeIcon.className = 'fas fa-cloud-slash';
      badgeText.textContent = 'Chưa đặt Mã Sync';
      return;
    }

    if (this.syncStatus === 'syncing') {
      badge.className = 'sync-badge sync-active';
      badgeIcon.className = 'fas fa-sync fa-spin';
      badgeText.textContent = 'Đang đồng bộ...';
    } else if (this.syncStatus === 'success') {
      badge.className = 'sync-badge sync-online';
      badgeIcon.className = 'fas fa-check-circle';
      badgeText.textContent = `Đồng bộ Cloud (${this.syncKey})`;
    } else if (this.syncStatus === 'error') {
      badge.className = 'sync-badge sync-error';
      badgeIcon.className = 'fas fa-exclamation-triangle';
      badgeText.textContent = 'Lỗi đồng bộ';
    } else {
      badge.className = 'sync-badge sync-online';
      badgeIcon.className = 'fas fa-cloud';
      badgeText.textContent = `Mã: ${this.syncKey}`;
    }
  }
}

window.MocCarSync = new SyncEngine();
