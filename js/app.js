/**
 * MỘC CAR - MAIN APPLICATION CONTROLLER
 * Coordinates UI tabs, mobile drawer sidebar, modal listeners, toasts, and initialization.
 */

window.MocCarApp = {
  currentTab: 'calendar',

  init() {
    this.bindNavigation();
    this.bindGlobalModals();

    window.MocCarBooking.init();
    window.MocCarCalendar.init();
    window.MocCarFleet.init();
    window.MocCarReports.init();
    if (window.MocCarSync) window.MocCarSync.init();

    // Check for synckey in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const syncParam = urlParams.get('synckey');
    if (syncParam && window.MocCarSync) {
      window.MocCarSync.setSyncKey(syncParam);
      window.MocCarSync.pullFromCloud({ silent: false });
    }

    window.MocCarBooking.populateCarDropdown();
    this.switchTab('calendar');

    console.log('Mộc Car Rental System initialized successfully.');
  },

  bindNavigation() {
    const navButtons = document.querySelectorAll('.nav-item button[data-tab]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
        this.closeMobileSidebar();
      });
    });

    const filterCar = document.getElementById('filter-car');
    const filterStatus = document.getElementById('filter-status');
    const filterSearch = document.getElementById('filter-search');

    if (filterCar) filterCar.addEventListener('change', () => window.MocCarBooking.renderRentalTable());
    if (filterStatus) filterStatus.addEventListener('change', () => window.MocCarBooking.renderRentalTable());
    if (filterSearch) filterSearch.addEventListener('input', () => window.MocCarBooking.renderRentalTable());
  },

  toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      const isOpen = sidebar.classList.contains('open');
      if (isOpen) {
        this.closeMobileSidebar();
      } else {
        sidebar.classList.add('open');
        if (backdrop) backdrop.style.display = 'block';
      }
    }
  },

  closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.style.display = 'none';
  },

  bindGlobalModals() {
    const modals = document.querySelectorAll('.modal-backdrop');
    modals.forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    const closeBtns = document.querySelectorAll('.modal-close, [data-dismiss="modal"]');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.currentTarget.closest('.modal-backdrop');
        if (modal) modal.classList.remove('active');
      });
    });
  },

  switchTab(tabId) {
    this.currentTab = tabId;

    document.querySelectorAll('.nav-item').forEach(li => {
      const btn = li.querySelector('button');
      if (btn && btn.getAttribute('data-tab') === tabId) {
        li.classList.add('active');
      } else {
        li.classList.remove('active');
      }
    });

    document.querySelectorAll('.view-section').forEach(section => {
      if (section.id === `view-${tabId}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    this.refreshAllViews();
  },

  refreshAllViews() {
    const carFilterSelect = document.getElementById('filter-car');
    if (carFilterSelect) {
      const cars = window.MocCarStore.getCars();
      const currentVal = carFilterSelect.value;
      carFilterSelect.innerHTML = '<option value="">-- Tất cả các xe --</option>' +
        cars.map(c => `<option value="${c.id}">${c.name} (${c.bks})</option>`).join('');
      carFilterSelect.value = currentVal;
    }

    if (this.currentTab === 'dashboard') {
      window.MocCarReports.renderDashboard();
    } else if (this.currentTab === 'calendar') {
      window.MocCarCalendar.render();
    } else if (this.currentTab === 'bookings') {
      window.MocCarBooking.renderRentalTable();
    } else if (this.currentTab === 'fleet') {
      window.MocCarFleet.renderFleetGrid();
    }

    // Sidebar mini stat: Cumulative Realized Revenue (Cộng Dồn Thực Thu)
    const stats = window.MocCarStore.getDashboardStats();
    const miniRev = document.getElementById('mini-stat-revenue');
    if (miniRev) {
      miniRev.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.cumulativeRealizedRevenue);
    }
  },

  showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';

    let icon = 'fa-check-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    if (type === 'info') icon = 'fa-info-circle';
    if (type === 'danger') icon = 'fa-times-circle';

    toast.innerHTML = `<i class="fas ${icon}" style="font-size: 1.1rem; color: var(--primary);"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  exportDataBackup() {
    const jsonStr = window.MocCarStore.exportDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MocCar_Data_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Đã xuất file sao lưu dữ liệu JSON thành công!', 'success');
  },

  triggerImportData() {
    const input = document.getElementById('import-json-file');
    if (input) input.click();
  },

  handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const success = window.MocCarStore.importDataJSON(content);
      if (success) {
        this.showToast('Đã khôi phục dữ liệu từ file sao lưu thành công!', 'success');
        this.refreshAllViews();
      } else {
        this.showToast('File JSON không hợp lệ!', 'danger');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  },

  resetData() {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu? Các xe và đơn thuê sẽ bị xóa sạch.')) {
      window.MocCarStore.resetDefaultData();
      this.showToast('Đã xóa sạch dữ liệu!', 'info');
      this.refreshAllViews();
    }
  },

  // --- SYNC MODAL CONTROLLERS ---
  openSyncModal() {
    const modal = document.getElementById('modal-sync');
    if (!modal) return;

    const inputKey = document.getElementById('sync-key-input');
    const autoSyncCheckbox = document.getElementById('auto-sync-toggle');
    
    if (inputKey && window.MocCarSync) {
      inputKey.value = window.MocCarSync.syncKey || '';
    }
    if (autoSyncCheckbox && window.MocCarSync) {
      autoSyncCheckbox.checked = window.MocCarSync.autoSyncEnabled;
    }

    this.renderSyncQR();
    if (window.MocCarSync) window.MocCarSync.updateUIStatus();
    modal.classList.add('active');
  },

  saveSyncKeyInput() {
    const inputKey = document.getElementById('sync-key-input');
    if (!inputKey || !window.MocCarSync) return;
    const val = inputKey.value.trim().toUpperCase();
    if (!val) {
      this.showToast('Vui lòng nhập Mã Đồng Bộ!', 'warning');
      return;
    }
    window.MocCarSync.setSyncKey(val);
    this.renderSyncQR();
    this.showToast(`Đã lưu Mã Đồng Bộ: ${val}`, 'success');
  },

  generateNewSyncKey() {
    if (!window.MocCarSync) return;
    const newKey = window.MocCarSync.generateRandomSyncKey();
    const inputKey = document.getElementById('sync-key-input');
    if (inputKey) inputKey.value = newKey;
    window.MocCarSync.setSyncKey(newKey);
    this.renderSyncQR();
    this.showToast(`Đã tạo Mã Đồng Bộ mới: ${newKey}`, 'success');
  },

  toggleAutoSyncSetting(event) {
    if (!window.MocCarSync) return;
    window.MocCarSync.setAutoSync(event.target.checked);
    this.showToast(event.target.checked ? 'Đã BẬT Tự động đồng bộ Cloud!' : 'Đã TẮT Tự động đồng bộ Cloud', 'info');
  },

  async pushCloudData() {
    if (!window.MocCarSync) return;
    const btn = document.getElementById('btn-push-cloud');
    if (btn) btn.disabled = true;
    await window.MocCarSync.pushToCloud({ silent: false });
    if (btn) btn.disabled = false;
  },

  async pullCloudData() {
    if (!window.MocCarSync) return;
    const btn = document.getElementById('btn-pull-cloud');
    if (btn) btn.disabled = true;
    await window.MocCarSync.pullFromCloud({ silent: false });
    if (btn) btn.disabled = false;
  },

  copySyncKeyToClipboard() {
    if (!window.MocCarSync || !window.MocCarSync.syncKey) {
      this.showToast('Chưa có Mã Đồng Bộ để sao chép!', 'warning');
      return;
    }
    navigator.clipboard.writeText(window.MocCarSync.syncKey).then(() => {
      this.showToast('Đã sao chép Mã Đồng Bộ vào khay nhớ tạm!', 'success');
    }).catch(() => {
      this.showToast(`Mã Đồng Bộ: ${window.MocCarSync.syncKey}`, 'info');
    });
  },

  copyQuickCodeToClipboard() {
    if (!window.MocCarSync) return;
    const code = window.MocCarSync.getQuickSyncCode();
    navigator.clipboard.writeText(code).then(() => {
      this.showToast('Đã sao chép Mã Đồng Bộ Nhanh!', 'success');
    }).catch(() => {
      this.showToast('Không thể truy cập khay nhớ tạm!', 'warning');
    });
  },

  importQuickCodeFromInput() {
    const textarea = document.getElementById('quick-sync-code-input');
    if (!textarea || !textarea.value.trim()) {
      this.showToast('Vui lòng dán Mã Đồng Bộ Nhanh!', 'warning');
      return;
    }
    const success = window.MocCarSync.importQuickSyncCode(textarea.value);
    if (success) {
      textarea.value = '';
      const modal = document.getElementById('modal-sync');
      if (modal) modal.classList.remove('active');
    } else {
      this.showToast('Mã đồng bộ nhanh không hợp lệ!', 'danger');
    }
  },

  renderSyncQR() {
    const qrImg = document.getElementById('sync-qr-image');
    const qrContainer = document.getElementById('sync-qr-container');
    if (!qrImg || !window.MocCarSync) return;

    const key = window.MocCarSync.syncKey;
    if (!key) {
      if (qrContainer) qrContainer.style.display = 'none';
      return;
    }

    if (qrContainer) qrContainer.style.display = 'block';
    const qrData = encodeURIComponent(`${window.location.origin}${window.location.pathname}?synckey=${key}`);
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${qrData}&color=1e293b&bgcolor=f8fafc`;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.MocCarApp.init();
});
