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
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.MocCarApp.init();
});
