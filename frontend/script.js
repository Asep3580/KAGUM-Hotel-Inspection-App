document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const API_BASE_URL = 'https://kagum-hotel-inspection-app.onrender.com/api';

    // --- HELPER FUNCTIONS ---    
    const fetchWithAuth = async (url, options = {}) => {
        const token = localStorage.getItem('authToken');
        // Jika body adalah FormData, jangan set Content-Type. Browser akan melakukannya secara otomatis.
        const isFormData = options.body instanceof FormData;
    
        const headers = {
            // Biarkan browser mengatur Content-Type untuk FormData
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            ...options.headers,
        };
    
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    
        const response = await fetch(url, { ...options, headers });
    
        if (response.status === 401) {
            localStorage.removeItem('authToken');
            alert('Sesi Anda telah berakhir. Silakan login kembali.');
            window.location.href = 'login.html';
            throw new Error('Token tidak valid atau sesi berakhir.');
        }
    
        return response;
    };

    const parseJwt = (token) => {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            return null;
        }
    };

    const updateUiForRole = (role) => {
        const adminOnlyElements = [
            manageHotelsCard,
            manageUsersCard,
            manageRolesCard,
            settingsMenuLink,
            resetSequencesCard
        ];

        // Tampilkan elemen yang hanya untuk admin jika peran adalah 'admin'
        if (role === 'admin') {
            adminOnlyElements.forEach(el => {
                if (el) {
                    // Link di sidebar menggunakan flexbox
                    el.style.display = el.tagName === 'A' ? 'flex' : 'block';
                }
            });
        } else {
            adminOnlyElements.forEach(el => {
                if (el) el.style.display = 'none';
            });
        }
    };
    // --- DOM ELEMENTS ---
    const woFormPhotosInput = document.getElementById('wo-form-photos-input');
    const woFormPhotosPreview = document.getElementById('wo-form-photos-preview');
    const woFilterStatus = document.getElementById('wo-filter-status');
    const woFilterAssignee = document.getElementById('wo-filter-assignee');
    const woFilterBtn = document.getElementById('wo-filter-btn');
    const woClearFilterBtn = document.getElementById('wo-clear-filter-btn');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const sidebar = document.getElementById('sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const sidebarCloseButton = document.getElementById('sidebar-close-button');
    const settingsMenuLink = document.getElementById('settings-menu-link');
    const pageContents = document.querySelectorAll('.page-content');
    const hotelSelector = document.getElementById('hotel-selector');
    const pageTitle = document.getElementById('page-title');
    const roomForm = document.getElementById('room-inspection-form');
    const areaForm = document.getElementById('area-inspection-form');
    const inspectionList = document.getElementById('inspection-list');
    const emptyState = document.getElementById('empty-state');
    const roomStatusGrid = document.getElementById('room-status-grid');
    const areaStatusGrid = document.getElementById('area-status-grid');
    const dashboardStatsContainer = document.querySelector('#dashboard-page .grid');
    const reportsTableBody = document.getElementById('reports-table-body');
    const reportHotelHeader = document.getElementById('report-hotel-header');
    const manageAreasCard = document.getElementById('manage-areas-card');
    const manageRoomsCard = document.getElementById('manage-rooms-card');
    const manageRoomChecklistCard = document.getElementById('manage-room-checklist-card');
    const manageAreaChecklistCard = document.getElementById('manage-area-checklist-card');
    const manageHotelsCard = document.getElementById('manage-hotels-card');
    const manageUsersCard = document.getElementById('manage-users-card');
    const manageRolesCard = document.getElementById('manage-roles-card');
    const resetSequencesCard = document.getElementById('reset-sequences-card');
    
    // Inspection Page Elements
    const inspectionSelectionView = document.getElementById('inspection-selection');
    const inspectionFormView = document.getElementById('inspection-form-view');
    const inspectionPromptMessage = document.getElementById('inspection-prompt-message');
    const selectRoomCard = document.getElementById('select-room-inspection-card');
    const selectAreaCard = document.getElementById('select-area-inspection-card');
    const backToSelectionBtn = document.getElementById('back-to-selection-btn');
    const roomInspectionContent = document.getElementById('room-inspection');
    const inspectorNameRoomInput = document.getElementById('inspector-name-room');
    const inspectorNameAreaInput = document.getElementById('inspector-name-area');
    const userGreeting = document.getElementById('user-greeting');
    const areaInspectionContent = document.getElementById('area-inspection');
    const photosRoomInput = document.getElementById('photos-room');
    const photosPreviewRoom = document.getElementById('photos-preview-room');
    const photosAreaInput = document.getElementById('photos-area');
    const photosPreviewArea = document.getElementById('photos-preview-area');

    // Photo Viewer Modal Elements
    const photoViewerModal = document.getElementById('photo-viewer-modal');
    const photoViewerContent = document.getElementById('photo-viewer-content');
    const closePhotoViewerBtn = document.getElementById('close-photo-viewer-btn');

    const visualStatusToggle = document.getElementById('visual-status-toggle');
    let kpiChart = null; // To hold the chart instance
    const roomStatusContainer = document.getElementById('room-status-container');
    const toggleIcon = document.getElementById('toggle-icon');

    const visualAreaToggle = document.getElementById('visual-area-toggle');
    const areaStatusContainer = document.getElementById('area-status-container');
    const toggleAreaIcon = document.getElementById('toggle-area-icon');

    // Room Management Page Elements
    const roomModal = document.getElementById('room-modal');
    const roomModalForm = document.getElementById('room-modal-form');
    const roomModalTitle = document.getElementById('room-modal-title');
    const roomIdInput = document.getElementById('room-id-input');
    const roomNumberInput = document.getElementById('room-number-input');
    const roomTypeInput = document.getElementById('room-type-input');
    const roomsTableBody = document.getElementById('rooms-table-body');

    // Area Management Page Elements
    const areaModal = document.getElementById('area-modal');
    const areaModalForm = document.getElementById('area-modal-form');
    const areaModalTitle = document.getElementById('area-modal-title');
    const areaIdInput = document.getElementById('area-id-input');
    const areaNameInput = document.getElementById('area-name-input');
    const areasTableBody = document.getElementById('areas-table-body');
    const areaNameDropdown = document.getElementById('area-name');

    // Room Checklist Management Page Elements
    const roomChecklistModal = document.getElementById('room-checklist-modal');
    const roomChecklistModalForm = document.getElementById('room-checklist-modal-form');
    const roomChecklistModalTitle = document.getElementById('room-checklist-modal-title');
    const checklistItemIdInput = document.getElementById('checklist-item-id-input');
    const checklistItemNameInput = document.getElementById('checklist-item-name-input');
    const roomChecklistTableBody = document.getElementById('room-checklist-table-body');
    const roomChecklistDynamicContainer = document.getElementById('room-checklist-dynamic');

    // Area Checklist Management Page Elements
    const areaChecklistModal = document.getElementById('area-checklist-modal');
    const areaChecklistModalForm = document.getElementById('area-checklist-modal-form');
    const areaChecklistModalTitle = document.getElementById('area-checklist-modal-title');
    const areaChecklistItemIdInput = document.getElementById('area-checklist-item-id-input');
    const areaChecklistItemNameInput = document.getElementById('area-checklist-item-name-input');
    const areaChecklistTableBody = document.getElementById('area-checklist-table-body');
    const areaChecklistDynamicContainer = document.getElementById('area-checklist-dynamic');

    // User Management Page Elements
    const userModal = document.getElementById('user-modal');
    const userModalForm = document.getElementById('user-modal-form');
    const userModalTitle = document.getElementById('user-modal-title');
    const userIdInput = document.getElementById('user-id-input');
    const userUsernameInput = document.getElementById('user-username-input');
    const userEmailInput = document.getElementById('user-email-input');
    const userPasswordInput = document.getElementById('user-password-input');
    const userRoleSelect = document.getElementById('user-role-select');
    const usersTableBody = document.getElementById('users-table-body');
    const passwordHelpText = document.getElementById('password-help-text');
    const rolesContainer = document.getElementById('roles-container');
    const hotelAssignmentContainer = document.getElementById('hotel-assignment-container');
    const hotelAssignmentChecklist = document.getElementById('hotel-assignment-checklist');
    const hotelDisplayName = document.getElementById('hotel-display-name');

    // Profile Page Elements
    const profileLink = document.getElementById('profile-link');
    const changePasswordForm = document.getElementById('change-password-form');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    // --- STATE MANAGEMENT ---
    let currentUser = null;
    let currentHotelId = null;
    let reportFilters = {};
    let woFilters = {};

    const getCurrentHotelId = () => {
        return localStorage.getItem('currentHotelId');
    };

    const setCurrentHotelId = (hotelId) => {
        localStorage.setItem('currentHotelId', hotelId);
        currentHotelId = hotelId;
    };

    // Hotel Management Page Elements
    const hotelModal = document.getElementById('hotel-modal');
    const hotelModalForm = document.getElementById('hotel-modal-form');
    const hotelModalTitle = document.getElementById('hotel-modal-title'); // This seems to be a duplicate, but let's keep it for now
    const hotelIdInput = document.getElementById('hotel-id-input'); // This seems to be a duplicate, but let's keep it for now

    // Working Order Page Elements
    const woSelectionView = document.getElementById('wo-selection-view');
    const woListView = document.getElementById('wo-list-view');
    const woFormView = document.getElementById('wo-form-view');
    const selectWoFormCard = document.getElementById('select-wo-form-card');
    const selectWoListCard = document.getElementById('select-wo-list-card');
    const backToWoSelectionFromList = document.getElementById('back-to-wo-selection-from-list');
    const backToWoSelectionFromForm = document.getElementById('back-to-wo-selection-from-form');
    const woTableBody = document.getElementById('wo-table-body');
    const woForm = document.getElementById('wo-form');
    const woFormIdInput = document.getElementById('wo-form-id-input');
    const woFormStatusSelect = document.getElementById('wo-form-status-select');
    const woFormPrioritySelect = document.getElementById('wo-form-priority-select');
    const woFormInspectionSelect = document.getElementById('wo-form-inspection-select');
    const woFormInspectionNotesContainer = document.getElementById('wo-form-inspection-notes-container');
    const woFormInspectionNotesDisplay = document.getElementById('wo-form-inspection-notes-display');
    const woFormStartDate = document.getElementById('wo-form-start-date');
    const woFormTargetDate = document.getElementById('wo-form-target-date');
    const woFormMaterialsInput = document.getElementById('wo-form-materials-input');
    const woFormPhotosContainer = document.getElementById('wo-form-photos-container');
    const woFormAssigneeSelect = document.getElementById('wo-form-assignee-select');
    const hotelNameInput = document.getElementById('hotel-name-input');
    if (resetSequencesCard) {
        resetSequencesCard.addEventListener('click', async () => {
            const confirmation = prompt('PERINGATAN: Tindakan ini akan MENGHAPUS SEMUA data inspeksi dan working order, lalu mengatur ulang penomoran ke 1. Ini tidak dapat diurungkan. Ketik "RESET" untuk melanjutkan.');
            if (confirmation === 'RESET') {
                try {
                    const response = await fetchWithAuth(`${API_BASE_URL}/settings/reset-sequences`, {
                        method: 'POST'
                    });
                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.message || 'Gagal mereset penomoran.');
                    }
                    alert(result.message);
                    // Muat ulang aplikasi untuk menampilkan state yang bersih
                    window.location.reload();
                } catch (error) {
                    console.error('Error resetting sequences:', error);
                    alert(`Terjadi kesalahan: ${error.message}`);
                }
            } else {
                alert('Reset dibatalkan.');
            }
        });
    }
    const hotelAddressInput = document.getElementById('hotel-address-input');
    const hotelsTableBody = document.getElementById('hotels-table-body');

    const switchPage = async (pageId, navOptions = {}) => { // eslint-disable-line no-unused-vars
        // Perlindungan halaman berbasis peran
        const adminPages = [
            'settings-page', 'manage-rooms-page', 'manage-areas-page',
            'manage-room-checklist-page', 'manage-area-checklist-page',
            'manage-hotels-page', 'manage-users-page', 'manage-roles-page'
        ];

        if (adminPages.includes(pageId) && (!currentUser || currentUser.role !== 'admin')) {
            alert('Akses ditolak. Anda tidak memiliki izin.');
            return; // Hentikan navigasi
        }

        pageContents.forEach(page => page.classList.add('hidden'));
        document.getElementById(pageId).classList.remove('hidden');

        // Update page title based on the link clicked
        sidebarLinks.forEach(link => { // eslint-disable-line no-unused-vars
            link.classList.remove('active');
            if (link.dataset.page === pageId) {
                link.classList.add('active');
                pageTitle.textContent = link.textContent.trim();
            }
            if (pageId === 'profile-page') {
                pageTitle.textContent = 'Profil Pengguna';
            }
        });

        // Close sidebar on mobile after navigation
        if (window.innerWidth < 768) { // md breakpoint
            if (!sidebar.classList.contains('-translate-x-full')) {
                toggleSidebar();
            }
        }
        
        // Reset inspection page to selection view when navigating to it
        if (pageId === 'inspection-page') {
            const hotelId = getCurrentHotelId();
            if (hotelId === 'all') {
                // Jika admin memilih "Semua Hotel", tampilkan pesan dan sembunyikan pilihan inspeksi.
                inspectionSelectionView.classList.add('hidden');
                inspectionFormView.classList.add('hidden');
                inspectionPromptMessage.classList.remove('hidden');
            } else {
                // Jika hotel spesifik dipilih, tampilkan pilihan inspeksi seperti biasa.
                inspectionPromptMessage.classList.add('hidden');
                
                // Muat checklist dinamis
                renderDynamicRoomChecklist();
                renderDynamicAreaChecklist();

                // Periksa apakah kita menavigasi langsung ke formulir
                if (navOptions.formType && hotelId) {
                    showFormView(navOptions.formType);
                    
                    // Tunggu populasi dropdown, lalu atur nilainya
                    if (navOptions.formType === 'room') {
                        await populateRoomDropdown(hotelId);
                        document.getElementById('room-number-select').value = navOptions.targetValue;
                        populateAreaDropdown(hotelId); // jalankan di latar belakang
                    } else if (navOptions.formType === 'area') {
                        await populateAreaDropdown(hotelId);
                        document.getElementById('area-name').value = navOptions.targetValue;
                        populateRoomDropdown(hotelId); // jalankan di latar belakang
                    }
                } else {
                    // Perilaku default: tampilkan tampilan pilihan
                    showSelectionView();
                    if (hotelId) {
                        populateRoomDropdown(hotelId);
                        populateAreaDropdown(hotelId);
                    }
                }
            }
        }
        if (pageId === 'dashboard-page') {
            const hotelId = getCurrentHotelId();
            if (!hotelId) {
                console.warn('Peringatan: Tidak ada hotel yang dipilih.');
                roomStatusGrid.innerHTML = `<p class="col-span-full text-center text-slate-500">Pilih hotel terlebih dahulu.</p>`;
                areaStatusGrid.innerHTML = `<p class="col-span-full text-center text-slate-500">Pilih hotel terlebih dahulu.</p>`;
                if (kpiChart) kpiChart.destroy();
                document.getElementById('inspection-list').innerHTML = `<div class="text-center py-10"><p class="text-slate-500">Pilih hotel untuk melihat riwayat.</p></div>`;
                return;
            }

            let roomsUrl = `${API_BASE_URL}/dashboard/rooms`;
            let areasUrl = `${API_BASE_URL}/dashboard/areas`;
            if (hotelId && hotelId !== 'all') {
                roomsUrl += `?hotel_id=${hotelId}`;
                areasUrl += `?hotel_id=${hotelId}`;
            }

            Promise.all([
                fetchWithAuth(roomsUrl).then(res => res.ok ? res.json() : Promise.reject(res)),
                fetchWithAuth(areasUrl).then(res => res.ok ? res.json() : Promise.reject(res))
            ])
                .then(([roomsData, areasData]) => {
                    const isAllHotelsView = !hotelId || hotelId === 'all';
                    renderDashboardStatCards(roomsData);
                    renderStatusGrid({ gridElement: roomStatusGrid, items: roomsData, targetKey: 'room_number', formType: 'room', formElementId: 'room-number-select', noDataMessage: 'Belum ada kamar yang terdaftar.', isAllHotelsView });
                    renderStatusGrid({ gridElement: areaStatusGrid, items: areasData, targetKey: 'area_name', formType: 'area', formElementId: 'area-name', noDataMessage: 'Belum ada area yang terdaftar.', isAllHotelsView });
    
                    // Aggregate stats for KPI chart
                    const allItems = [...roomsData, ...areasData];
                    const kpiStats = { good: 0, inProgress: 0, needsImprovement: 0 };
                    allItems.forEach(item => {
                        if (item.status === 'Baik') kpiStats.good++;
                        else if (item.status === 'In Progress') kpiStats.inProgress++;
                        else if (item.status === 'Kurang') kpiStats.needsImprovement++;
                    });
    
                    // Render the new chart
                    renderKpiChart(kpiStats);
                })
                .catch(async (errorResponse) => {
                    let errorMessage = 'Gagal memuat data dasbor.';
                    if (errorResponse.json) {
                        try {
                            const errorData = await errorResponse.json();
                            errorMessage = errorData.message || errorMessage;
                        } catch (e) { /* response was not json */ }
                    } else if (errorResponse.message) {
                        errorMessage = errorResponse.message;
                    }
                    console.error('Dashboard data fetch error:', errorResponse);
                    roomStatusGrid.innerHTML = `<p class="col-span-full text-center text-red-500">Terjadi kesalahan: ${errorMessage}</p>`;
                    areaStatusGrid.innerHTML = `<p class="col-span-full text-center text-red-500">Terjadi kesalahan: ${errorMessage}</p>`;
                });
    
            renderShortHistory(hotelId);
        }
        if (pageId === 'manage-rooms-page') {
            setupManagementPage.rooms();
        }
        if (pageId === 'manage-areas-page') {
            setupManagementPage.areas();
        }
        if (pageId === 'manage-room-checklist-page') {
            setupManagementPage.roomChecklist();
        }
        if (pageId === 'manage-area-checklist-page') {
            setupManagementPage.areaChecklist();
        }
        if (pageId === 'manage-hotels-page') {
            setupManagementPage.hotels();
        }
        if (pageId === 'manage-users-page') {
            setupManagementPage.users();
        }
        if (pageId === 'working-order-page') {
            // Reset to selection view every time we navigate to this "page"
            if (woSelectionView) woSelectionView.classList.remove('hidden');
            if (woListView) woListView.classList.add('hidden');
            if (woFormView) woFormView.classList.add('hidden');
        }
        if (pageId === 'manage-roles-page') {
            renderRolesPage();
        }
        if (pageId === 'reports-page') {
            const hotelId = getCurrentHotelId();
            if (hotelId) renderReports(hotelId);
        }
        feather.replace(); // Ensure icons are rendered on page switch
    };

    const showFormView = (formType) => {
        inspectionSelectionView.classList.add('hidden');
        inspectionFormView.classList.remove('hidden');
        roomInspectionContent.classList.add('hidden');
        areaInspectionContent.classList.add('hidden');
 
        if (formType === 'room') {
            roomInspectionContent.classList.remove('hidden');
        }
        if (formType === 'area') {
            areaInspectionContent.classList.remove('hidden');
        }
    };

    const showSelectionView = () => {
        inspectionFormView.classList.add('hidden');
        inspectionSelectionView.classList.remove('hidden');
    };

    const toggleSidebar = () => {
        sidebar.classList.toggle('-translate-x-full');
        sidebarBackdrop.classList.toggle('hidden');
    };

    const renderDashboardStatCards = (roomsWithStatus) => {
        try {
            const totalRooms = roomsWithStatus.length;
            let goodCount = 0;
            let needsImprovementCount = 0;
            let inProgressCount = 0;
            let notInspectedCount = 0;

            roomsWithStatus.forEach(room => {
                switch (room.status) {
                    case 'Baik':
                        goodCount++;
                        break;
                    case 'Kurang':
                        needsImprovementCount++;
                        break;
                    case 'In Progress':
                        inProgressCount++;
                        break;
                    default: // 'Belum Diinspeksi'
                        notInspectedCount++;
                        break;
                }
            });

            // Update the DOM
            document.getElementById('stats-total-rooms').textContent = totalRooms;
            document.getElementById('stats-good-condition').textContent = goodCount;
            document.getElementById('stats-needs-improvement').textContent = needsImprovementCount;
            document.getElementById('stats-in-progress').textContent = inProgressCount;
            document.getElementById('stats-not-inspected').textContent = notInspectedCount;

        } catch (error) {
            console.error('Error rendering dashboard stats:', error);
        }
    };

    const renderStatusGrid = ({ gridElement, items, targetKey, formType, formElementId, noDataMessage, isAllHotelsView }) => {
        gridElement.innerHTML = '';
        if (!items || items.length === 0) {
            gridElement.innerHTML = `<p class="col-span-full text-center text-slate-500">${noDataMessage}</p>`;
            return;
        }
    
        if (formType === 'room') {
            gridElement.className = isAllHotelsView
                ? 'grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-2 sm:gap-4 pt-4'
                : 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-4 pt-4';
        } else if (formType === 'area') {
            // Areas might have longer names, so fewer columns might be better. Adjust as needed.
            gridElement.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pt-4';
        }
    
        const fragment = document.createDocumentFragment();

        items.forEach(item => {
            const { status, hotel_name } = item;
            const targetValue = item[targetKey];
            const isClickable = status === 'Belum Diinspeksi';
            let bgColor = 'bg-slate-300', textColor = 'text-slate-700';
            if (status === 'Baik') { bgColor = 'bg-green-100'; textColor = 'text-green-800'; }
            else if (status === 'Kurang') { bgColor = 'bg-red-100'; textColor = 'text-red-800'; }
            else if (status === 'In Progress') { bgColor = 'bg-yellow-100'; textColor = 'text-yellow-800'; }
    
            const itemEl = document.createElement('div');
            let classNames = `p-2 rounded-md text-center ${bgColor} ${textColor} shadow-sm transition-all duration-200 flex flex-col justify-between`;
            if (isClickable) {
                classNames += ' cursor-pointer hover:shadow-md hover:scale-105';
            } else {
                classNames += ' cursor-not-allowed opacity-80';
            }
            itemEl.className = classNames;
    
            let itemHtml = `<div class="font-bold text-sm sm:text-base">${targetValue}</div>`;
            if (isAllHotelsView && hotel_name) {
                itemHtml += `<div class="text-[9px] font-light truncate">${hotel_name}</div>`;
            }
            itemHtml += `<div class="text-[10px] sm:text-xs font-medium mt-1">${status}</div>`;
            itemEl.innerHTML = itemHtml;
    
            if (isClickable) {
                itemEl.addEventListener('click', () => {
                    // Jika klik berasal dari tampilan "Semua Hotel", kita harus mengatur
                    // konteks ke hotel spesifik dari item yang diklik terlebih dahulu.
                    if (isAllHotelsView && item.hotel_id) {
                        setCurrentHotelId(item.hotel_id);
                        // Perbarui juga dropdown pemilih hotel untuk mencerminkan perubahan
                        if (hotelSelector) {
                            hotelSelector.value = item.hotel_id;
                        }
                    }
    
                    switchPage('inspection-page', { 
                        formType: formType, 
                        targetValue: targetValue 
                    });
                });
            }
    
            fragment.appendChild(itemEl);
        });

        gridElement.appendChild(fragment);
    };

    const renderKpiChart = (stats) => {
        const ctx = document.getElementById('kpi-chart')?.getContext('2d');
        if (!ctx) return;
    
        const { good, inProgress, needsImprovement } = stats;
        const total = good + inProgress + needsImprovement;
    
        if (kpiChart) {
            kpiChart.destroy();
        }

        if (total === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.font = "16px Inter, sans-serif";
            ctx.fillStyle = "#64748b";
            ctx.textAlign = "center";
            ctx.fillText('Tidak ada data untuk ditampilkan', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }
    
        kpiChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Kondisi Baik', 'Dalam Perbaikan', 'Perlu Perbaikan'],
                datasets: [{
                    label: 'Status Maintenance',
                    data: [good, inProgress, needsImprovement],
                    backgroundColor: [
                        '#22c55e', // text-green-500
                        '#eab308', // text-yellow-500
                        '#ef4444'  // text-red-500
                    ],
                    borderColor: '#ffffff',
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { family: 'Inter, sans-serif' } } }
                },
                cutout: '65%'
            }
        });
    };

    const renderShortHistory = async (hotelId) => {
        if (!inspectionList) return;
        inspectionList.innerHTML = `<p class="text-center text-slate-500 p-4">Memuat riwayat...</p>`;
        if (!hotelId) return;

        try {
            // Tentukan URL untuk riwayat inspeksi dan WO
            let inspectionUrl = `${API_BASE_URL}/inspections/recent`;
            let woUrl = `${API_BASE_URL}/working-orders/recent`; // Endpoint baru
            if (hotelId && hotelId !== 'all') {
                inspectionUrl += `?hotel_id=${hotelId}`;
                woUrl += `?hotel_id=${hotelId}`;
            }

            const [inspectionRes, woRes] = await Promise.all([
                fetchWithAuth(inspectionUrl),
                fetchWithAuth(woUrl)
            ]);

            if (!inspectionRes.ok) {
                const errorData = await inspectionRes.json().catch(() => ({ message: `Status ${inspectionRes.status}` }));
                throw new Error(`Gagal memuat riwayat inspeksi: ${errorData.message}`);
            }
            if (!woRes.ok) {
                const errorData = await woRes.json().catch(() => ({ message: `Status ${woRes.status}` }));
                throw new Error(`Gagal memuat riwayat WO: ${errorData.message}`);
            }

            const inspectionHistory = await inspectionRes.json();
            const woHistory = await woRes.json();

            // Gabungkan, urutkan berdasarkan timestamp (terbaru dulu), dan ambil 10 item teratas
            const combinedHistory = [...inspectionHistory, ...woHistory];
            combinedHistory.sort((a, b) => new Date(b.event_timestamp) - new Date(a.event_timestamp));
            const recentHistory = combinedHistory.slice(0, 10);

            inspectionList.innerHTML = ''; // Clear loading
            if (recentHistory.length === 0) {
                inspectionList.appendChild(emptyState);
                emptyState.classList.remove('hidden');
            } else {
                if (emptyState) emptyState.classList.add('hidden');
                recentHistory.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'p-3 border rounded-lg flex items-center space-x-3';

                    let icon = '';
                    let title = '';
                    let details = '';
                    let iconColor = 'text-slate-500';
                    const target = item.target_id ? (item.inspection_type === 'Kamar' ? `Kamar ${item.target_id}` : item.target_id) : `WO #${item.wo_id}`;

                    switch (item.event_type) {
                        case 'INSPECTION':
                            icon = 'file-plus';
                            title = `Inspeksi Baru: ${target}`;
                            details = `Oleh ${item.inspector_name} pada ${item.formatted_date}`;
                            iconColor = item.overall_status === 'Kurang' ? 'text-red-500' : 'text-green-500';
                            break;
                        case 'IN_PROGRESS':
                            icon = 'play-circle';
                            iconColor = 'text-yellow-600';
                            title = `Perbaikan Dimulai: ${target}`;
                            details = `Status diubah pada ${item.formatted_date}`;
                            break;
                        case 'COMPLETED':
                            icon = 'check-circle';
                            iconColor = 'text-green-500';
                            title = `Perbaikan Selesai: ${target}`;
                            details = `Status diubah pada ${item.formatted_date}`;
                            break;
                        // Kasus baru untuk Working Order
                        case 'WO_CREATED':
                            icon = 'tool';
                            title = `WO Dibuat: ${target}`;
                            details = `Ditugaskan ke ${item.assignee_name || 'Belum Ditugaskan'} pada ${item.formatted_date}`;
                            iconColor = 'text-blue-500';
                            break;
                        case 'WO_UPDATED':
                            icon = 'activity';
                            title = `WO Diperbarui: ${target}`;
                            details = `Status sekarang "${item.status}" pada ${item.formatted_date}`;
                            iconColor = 'text-purple-500';
                            break;
                    }

                    div.innerHTML = `
                        <div class="flex-shrink-0"><i data-feather="${icon}" class="w-5 h-5 ${iconColor}"></i></div>
                        <div>
                            <div class="font-semibold text-sm">${title}</div>
                            <p class="text-xs text-slate-500 mt-1">${details}</p>
                        </div>`;
                    inspectionList.appendChild(div);
                });
                feather.replace();
            }
        } catch (error) {
            console.error('Error rendering short history:', error);
            inspectionList.innerHTML = `<div class="text-center py-10"><p class="text-red-500">Terjadi kesalahan: ${error.message}</p></div>`;
        }
    };
    
    const renderReports = async (hotelId) => {
        const reportsTableBody = document.getElementById('reports-table-body');
        const reportsTheadRow = document.querySelector('#reports-page thead tr'); // Target baris header
        if (!reportsTableBody || !reportsTheadRow) return;

        const isAllHotelsView = hotelId === 'all';

        // Tampilkan atau sembunyikan kolom header "Hotel" berdasarkan view
        let hotelHeader = document.getElementById('report-hotel-header');
        if (hotelHeader) {
            hotelHeader.style.display = isAllHotelsView ? '' : 'none';
        }

        const colSpan = reportsTheadRow.querySelectorAll('th:not([style*="display: none"])').length;

        if (!hotelId) {
            reportsTableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center p-8 text-slate-500">Pilih hotel untuk melihat laporan</td></tr>`;
            return;
        }

        reportsTableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center p-8 text-slate-500">Memuat laporan...</td></tr>`;

        const params = new URLSearchParams();
        if (hotelId && hotelId !== 'all') {
            params.append('hotel_id', hotelId);
        }
        if (reportFilters.status) params.append('status', reportFilters.status);
        if (reportFilters.startDate) params.append('startDate', reportFilters.startDate);
        if (reportFilters.endDate) params.append('endDate', reportFilters.endDate);


        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/inspections?${params.toString()}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Gagal mengambil data laporan');
            }
            const reports = await response.json();

            // Urutkan laporan berdasarkan ID dari yang terbaru ke terlama untuk UX yang lebih baik
            reports.sort((a, b) => b.inspection_id - a.inspection_id);

            if (reports.length === 0) {
                reportsTableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center p-8 text-slate-500">Tidak ada data laporan untuk filter yang dipilih</td></tr>`;
                return;
            }

            reportsTableBody.innerHTML = '';
            reports.forEach(report => {
                const row = document.createElement('tr');
                row.className = 'border-b border-slate-200 hover:bg-slate-50';

                let statusBadge;
                switch (report.overall_status) {
                    case 'Baik':
                        statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Baik</span>`;
                        break;
                    case 'Kurang':
                        statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Kurang</span>`;
                        break;
                    case 'In Progress':
                        statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Dalam Perbaikan</span>`;
                        break;
                    default:
                        statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">${report.overall_status}</span>`;
                }

                let actionButton = '';
                const isAdmin = currentUser && currentUser.role === 'admin';

                if (report.overall_status === 'Kurang' && isAdmin) {
                    actionButton = `<button class="create-wo-btn text-blue-500 hover:text-blue-700 p-1" title="Buat Working Order" data-inspection-id="${report.inspection_id}" data-target-id="${report.target_id}" data-hotel-id="${report.hotel_id}"><i data-feather="tool" class="w-5 h-5"></i></button>`;
                }
                if (isAdmin) {
                    actionButton += `<button class="delete-report-btn text-red-500 hover:text-red-700 p-1 ml-2" title="Hapus Laporan" data-id="${report.inspection_id}"><i data-feather="trash-2" class="w-5 h-5"></i></button>`;
                }

                const hotelCell = isAllHotelsView 
                    ? `<td class="p-4 text-sm text-slate-600">${report.hotel_name || '-'}</td>`
                    : '';

                const photosCell = `
                    <td class="p-4 text-center">
                        ${report.photos && report.photos.length > 0 ? 
                            `<button class="view-photos-btn text-blue-500 hover:text-blue-700" data-photos='${JSON.stringify(report.photos)}' title="Lihat Foto">
                                <i data-feather="camera" class="w-5 h-5"></i>
                             </button>` 
                            : '<span class="text-slate-400">-</span>'
                        }
                    </td>`;

                row.innerHTML = `
                    <td class="p-4 text-sm font-mono text-slate-500">#${report.inspection_id}</td>
                    <td class="p-4 whitespace-nowrap">${report.formatted_date}</td>
                    ${hotelCell}
                    <td class="p-4">${report.inspection_type}</td>
                    <td class="p-4">${report.target_id}</td>
                    <td class="p-4">${report.inspector_name}</td>
                    <td class="p-4">${statusBadge}</td>
                    <td class="p-4 text-sm text-slate-500">${report.notes || '-'}</td>
                    ${photosCell}
                    <td class="p-4 text-center flex justify-center items-center">${actionButton || '-'}</td>`;
                reportsTableBody.appendChild(row);
            });
            feather.replace();
        } catch (error) {
            console.error('Error rendering reports:', error);
            reportsTableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center p-8 text-red-500">Terjadi kesalahan: ${error.message}</td></tr>`;
        }
    };

    const renderWorkingOrders = async () => {
        if (!woTableBody) return;

        const params = new URLSearchParams();
        if (woFilters.status) params.append('status', woFilters.status);
        if (woFilters.assignee) params.append('assignee', woFilters.assignee);

        try {
            woTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-500">Memuat data...</td></tr>`;
            const response = await fetchWithAuth(`${API_BASE_URL}/working-orders?${params.toString()}`);
            if (!response.ok) throw new Error('Gagal memuat data working order');
            const workingOrders = await response.json();
    
            woTableBody.innerHTML = '';
            if (workingOrders.length === 0) {
                woTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-500">Belum ada working order.</td></tr>`;
                return;
            }
    
            workingOrders.forEach(wo => {
                const row = document.createElement('tr');
                row.className = 'border-b border-slate-200 hover:bg-slate-50';
                
                let statusBadge;
                switch (wo.status) {
                    case 'Open': statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Buka</span>`; break;
                    case 'In Progress': statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Dalam Perbaikan</span>`; break;
                    case 'Completed': statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Selesai</span>`; break;
                    case 'Cancelled': statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Dibatalkan</span>`; break;
                    default: statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">${wo.status}</span>`;
                }

                let priorityBadge;
                switch (wo.priority) {
                    case 'Tinggi': priorityBadge = `<span class="font-semibold text-red-600">Tinggi</span>`; break;
                    case 'Sedang': priorityBadge = `<span class="font-semibold text-yellow-600">Sedang</span>`; break;
                    case 'Rendah': priorityBadge = `<span class="font-semibold text-green-600">Rendah</span>`; break;
                    default: priorityBadge = `<span>${wo.priority || 'Sedang'}</span>`;
                }
    
                row.innerHTML = `
                    <td class="p-4 text-sm font-mono text-slate-500">#${wo.wo_id}</td>
                    <td class="p-4 text-sm font-semibold text-slate-800">${wo.target_id}</td>
                    <td class="p-4 text-sm">${priorityBadge}</td>
                    <td class="p-4 text-sm">${statusBadge}</td>
                    <td class="p-4 text-sm text-slate-700">${wo.assignee_name || '-'}</td>
                    <td class="p-4 text-sm text-slate-500">${wo.target_completion_date ? new Date(wo.target_completion_date).toLocaleDateString('id-ID') : '-'}</td>
                    <td class="p-4 text-center">
                        <button class="edit-wo-btn text-blue-500 hover:text-blue-700 p-1" title="Ubah WO" data-id="${wo.wo_id}"><i data-feather="edit-2" class="w-5 h-5"></i></button>
                        <button class="delete-wo-btn text-red-500 hover:text-red-700 p-1" title="Hapus WO" data-id="${wo.wo_id}"><i data-feather="trash-2" class="w-5 h-5"></i></button>
                    </td>
                `;
                woTableBody.appendChild(row);
            });
            feather.replace();
        } catch (error) {
            console.error('Error rendering working orders:', error);
            woTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Gagal memuat data</td></tr>`;
        }
    };

    const populateWoAssigneeDropdown = async () => {
        if (!woFormAssigneeSelect) return;
        woFormAssigneeSelect.innerHTML = `<option value="">Memuat penanggung jawab...</option>`;
        try {
            // Panggil endpoint yang lebih spesifik dan aman untuk mendapatkan pengguna yang bisa ditugaskan.
            const response = await fetchWithAuth(`${API_BASE_URL}/users/assignable`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Gagal memuat penanggung jawab');
            }
            const assignableUsers = await response.json(); // Backend sudah melakukan filter

            woFormAssigneeSelect.innerHTML = `<option value="">Pilih Penanggung Jawab</option>`;

            if (assignableUsers.length === 0) {
                woFormAssigneeSelect.innerHTML = `<option value="">Tidak ada pengguna yang bisa ditugaskan</option>`;
                return;
            }

            assignableUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.user_id;
                option.textContent = user.username;
                woFormAssigneeSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error populating assignee dropdown:', error);
            woFormAssigneeSelect.innerHTML = `<option value="">Terjadi kesalahan: ${error.message}</option>`;
        }
    };

    const showWoFormView = async (options = {}) => {
        woSelectionView.classList.add('hidden');
        woListView.classList.add('hidden');
        woFormView.classList.remove('hidden');
        woForm.reset();
        woFormInspectionNotesContainer.classList.add('hidden');
        woFormInspectionSelect.disabled = false;
        woFormPhotosPreview.innerHTML = '';
        woFormPhotosContainer.classList.add('hidden');

        // Populate assignee dropdown for admin or inspector
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'inspector')) {
            woFormAssigneeSelect.disabled = false;
            populateWoAssigneeDropdown();
        } else {
            // For other roles (like teknisi), disable the dropdown and show a placeholder
            woFormAssigneeSelect.disabled = true;
            woFormAssigneeSelect.innerHTML = `<option value="">Tidak dapat diubah</option>`;
        }

        // Populate inspection dropdown
        woFormInspectionSelect.innerHTML = `<option value="">Memuat inspeksi...</option>`;
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/inspections?status=Kurang`);
            if (!response.ok) throw new Error((await response.json()).message || 'Gagal memuat inspeksi');
            const deficientInspections = await response.json();

            woFormInspectionSelect.innerHTML = `<option value="">Pilih Laporan Inspeksi</option>`;
            if (deficientInspections.length === 0) {
                woFormInspectionSelect.innerHTML = `<option value="">Tidak ada inspeksi untuk ditindaklanjuti</option>`;
            }
            deficientInspections.forEach(insp => {
                const option = document.createElement('option');
                option.value = insp.inspection_id;
                option.textContent = `Insp #${insp.inspection_id} - ${insp.hotel_name} - ${insp.target_id}`;
                option.dataset.notes = insp.notes;
                woFormInspectionSelect.appendChild(option);
            });

        } catch (error) {
            console.error("Error fetching deficient inspections:", error);
            woFormInspectionSelect.innerHTML = `<option value="">Terjadi kesalahan: ${error.message}</option>`;
        }

        if (options.woId) {
            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/working-orders/${options.woId}`);
                if (!response.ok) throw new Error('Gagal memuat data working order');
                const woData = await response.json();

                woFormIdInput.value = woData.wo_id;

                // If user is not admin/inspector, we need to manually add the current assignee to the disabled dropdown
                if (currentUser.role !== 'admin' && currentUser.role !== 'inspector' && woData.assignee_id) {
                    woFormAssigneeSelect.innerHTML = ''; // Clear the placeholder
                    const option = document.createElement('option');
                    option.value = woData.assignee_id;
                    option.textContent = woData.assignee_name || `ID Pengguna: ${woData.assignee_id}`;
                    woFormAssigneeSelect.appendChild(option);
                }

                // Tampilkan foto yang sudah ada
                if (woData.photos && woData.photos.length > 0) {
                    const serverOrigin = new URL(API_BASE_URL).origin;
                    woData.photos.forEach(photo => {
                        const div = document.createElement('div');
                        div.className = 'relative w-full h-24 group';
                        div.innerHTML = `
                            <img src="${serverOrigin}${photo.path}" class="w-full h-full object-cover rounded-md">
                            <button type="button" class="delete-wo-photo-btn absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 leading-none opacity-0 group-hover:opacity-100 transition-opacity" data-photo-id="${photo.id}" title="Hapus Foto">
                                <i data-feather="x" class="w-3 h-3 pointer-events-none"></i>
                            </button>`;
                        woFormPhotosPreview.appendChild(div);
                    });
                }

                woFormStatusSelect.value = woData.status;
                woFormPrioritySelect.value = woData.priority;
                
                if (!woFormInspectionSelect.querySelector(`option[value="${woData.inspection_id}"]`)) {
                    const option = document.createElement('option');
                    option.value = woData.inspection_id;
                    option.textContent = `Insp #${woData.inspection_id} - ${woData.hotel_name} - ${woData.target_id}`;
                    option.dataset.notes = woData.inspection_notes;
                    woFormInspectionSelect.appendChild(option);
                }
                woFormInspectionSelect.value = woData.inspection_id;
                woFormInspectionSelect.disabled = true;

                woFormAssigneeSelect.value = woData.assignee_id;
                woFormStartDate.value = woData.start_date ? new Date(woData.start_date).toISOString().split('T')[0] : '';
                woFormTargetDate.value = woData.target_completion_date ? new Date(woData.target_completion_date).toISOString().split('T')[0] : '';
                woFormMaterialsInput.value = woData.materials;

                woFormInspectionSelect.dispatchEvent(new Event('change'));
                woFormStatusSelect.dispatchEvent(new Event('change'));
            } catch (error) {
                alert(`Terjadi kesalahan: ${error.message}`);
                showWoListView();
            }
        } else {
            woFormIdInput.value = '';
            if (options.inspectionId) {
                woFormInspectionSelect.value = options.inspectionId;
                woFormInspectionSelect.dispatchEvent(new Event('change'));
            }
        }
    };

    const renderDynamicRoomChecklist = async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/room-checklist-items`);
            if (!response.ok) throw new Error('Gagal memuat item checklist');
            const items = await response.json();

            roomChecklistDynamicContainer.innerHTML = ''; // Clear existing
            if (items.length > 0) {
                const title = document.createElement('h3');
                title.className = 'text-md font-semibold mb-1';
                title.textContent = 'Checklist Kebersihan';
                roomChecklistDynamicContainer.appendChild(title);

                items.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'flex items-center justify-between';
                    // Sanitize item name for the 'name' attribute
                    const nameAttr = `checklist_${item.item_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
                    div.innerHTML = `<span class="text-sm">${item.item_name}</span><div class="flex space-x-3"><label><input type="radio" name="${nameAttr}" value="Baik" class="mr-1" checked> Baik</label><label><input type="radio" name="${nameAttr}" value="Kurang" class="mr-1"> Kurang</label></div>`;
                    roomChecklistDynamicContainer.appendChild(div);
                });
            }
        } catch (error) {
            console.error('Error rendering dynamic checklist:', error);
            roomChecklistDynamicContainer.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        }
    };

    const renderDynamicAreaChecklist = async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/area-checklist-items`);
            if (!response.ok) throw new Error('Gagal memuat item checklist area');
            const items = await response.json();
    
            areaChecklistDynamicContainer.innerHTML = ''; // Clear existing
            if (items.length > 0) {
                const title = document.createElement('h3');
                title.className = 'text-md font-semibold mb-1';
                title.textContent = 'Checklist Kondisi';
                areaChecklistDynamicContainer.appendChild(title);
    
                items.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'flex items-center justify-between';
                    const nameAttr = `area_checklist_${item.item_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
                    div.innerHTML = `<span class="text-sm">${item.item_name}</span><div class="flex space-x-3"><label><input type="radio" name="${nameAttr}" value="Baik" class="mr-1" checked> Baik</label><label><input type="radio" name="${nameAttr}" value="Kurang" class="mr-1"> Kurang</label></div>`;
                    areaChecklistDynamicContainer.appendChild(div);
                });
            }
        } catch (error) {
            console.error('Error rendering dynamic area checklist:', error);
            areaChecklistDynamicContainer.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        }
    };

    const populateRoomDropdown = async (hotelId) => {
        const roomNumberSelect = document.getElementById('room-number-select');
        if (!roomNumberSelect) return;
        if (!hotelId) return roomNumberSelect.innerHTML = '<option value="">Pilih hotel dulu</option>';

        roomNumberSelect.innerHTML = '<option value="">Memuat kamar...</option>';
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/dashboard/rooms?hotel_id=${hotelId}`);
            if (!response.ok) {
                const errorText = await response.text();
                let errorData = { message: 'Gagal memuat daftar kamar.' };
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    console.error(`Respons server untuk dropdown kamar bukan JSON:`, errorText);
                    errorData.message = 'Respons server tidak valid.';
                }
                throw new Error(errorData.message || 'Gagal memuat daftar kamar.');
            }
            const rooms = await response.json();
            const uninspectedRooms = rooms.filter(room => room.status === 'Belum Diinspeksi');

            roomNumberSelect.innerHTML = '<option value="">Pilih Nomor Kamar</option>'; // Reset
            if (uninspectedRooms.length === 0) {
                roomNumberSelect.innerHTML = '<option value="">Semua kamar sudah diinspeksi</option>';
                return;
            }
            uninspectedRooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room.room_number;
                option.textContent = `${room.room_number}`; // Tipe kamar tidak tersedia di endpoint ini, tapi ini memenuhi permintaan utama.
                roomNumberSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error populating room dropdown:', error);
            roomNumberSelect.innerHTML = `<option value="">Error: ${error.message}</option>`;
        }
    };

    const populateAreaDropdown = async (hotelId) => {
        if (!hotelId) return areaNameDropdown.innerHTML = '<option value="">Pilih hotel dulu</option>';
        areaNameDropdown.innerHTML = '<option value="">Memuat area...</option>';
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/dashboard/areas?hotel_id=${hotelId}`);
            if (!response.ok) {
                const errorText = await response.text();
                let errorData = { message: 'Gagal memuat daftar area.' };
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    console.error(`Respons server untuk dropdown area bukan JSON:`, errorText);
                    errorData.message = 'Respons server tidak valid.';
                }
                throw new Error(errorData.message || 'Gagal memuat daftar area.');
            }
            const areas = await response.json();
            const uninspectedAreas = areas.filter(area => area.status === 'Belum Diinspeksi');

            areaNameDropdown.innerHTML = '<option value="">Pilih Area</option>'; // Reset
            if (uninspectedAreas.length === 0) {
                areaNameDropdown.innerHTML = '<option value="">Semua area sudah diinspeksi</option>';
                return;
            }
            uninspectedAreas.forEach(area => {
                const option = document.createElement('option');
                option.value = area.area_name;
                option.textContent = area.area_name;
                areaNameDropdown.appendChild(option);
            });
        } catch (error) {
            console.error('Error populating area dropdown:', error);
            areaNameDropdown.innerHTML = `<option value="">Terjadi kesalahan: ${error.message}</option>`;
        }
    };

    const openRoomModal = (mode = 'add', room = {}) => {
        roomModalForm.reset();
        if (mode === 'add') {
            roomModalTitle.textContent = 'Tambah Kamar Baru';
            roomIdInput.value = '';
        } else {
            roomModalTitle.textContent = 'Ubah Kamar';
            roomIdInput.value = room.room_id;
            roomNumberInput.value = room.room_number;
            roomTypeInput.value = room.room_type;
        }
        roomModal.classList.remove('hidden');
        roomModal.classList.add('flex');
    };

    const closeRoomModal = () => {
        roomModal.classList.add('hidden');
        roomModal.classList.remove('flex');
    };

    const openAreaModal = (mode = 'add', area = {}) => {
        areaModalForm.reset();
        if (mode === 'add') {
            areaModalTitle.textContent = 'Tambah Area Baru';
            areaIdInput.value = '';
        } else {
            areaModalTitle.textContent = 'Ubah Area';
            areaIdInput.value = area.area_id;
            areaNameInput.value = area.area_name;
        }
        areaModal.classList.remove('hidden');
        areaModal.classList.add('flex');
    };


    const closeAreaModal = () => {
        areaModal.classList.add('hidden');
        areaModal.classList.remove('flex');
    };

    const openRoomChecklistModal = (mode = 'add', item = {}) => {
        roomChecklistModalForm.reset();
        if (mode === 'add') {
            roomChecklistModalTitle.textContent = 'Tambah Item Checklist';
            checklistItemIdInput.value = '';
        } else {
            roomChecklistModalTitle.textContent = 'Ubah Item Checklist';
            checklistItemIdInput.value = item.item_id;
            checklistItemNameInput.value = item.item_name;
        }
        roomChecklistModal.classList.remove('hidden');
        roomChecklistModal.classList.add('flex');
    };

    const closeRoomChecklistModal = () => {
        roomChecklistModal.classList.add('hidden');
        roomChecklistModal.classList.remove('flex');
    };

    const openAreaChecklistModal = (mode = 'add', item = {}) => {
        areaChecklistModalForm.reset();
        if (mode === 'add') {
            areaChecklistModalTitle.textContent = 'Tambah Item Checklist Area';
            areaChecklistItemIdInput.value = '';
        } else {
            areaChecklistModalTitle.textContent = 'Ubah Item Checklist Area';
            areaChecklistItemIdInput.value = item.item_id;
            areaChecklistItemNameInput.value = item.item_name;
        }
        areaChecklistModal.classList.remove('hidden');
        areaChecklistModal.classList.add('flex');
    };

    const closeAreaChecklistModal = () => {
        areaChecklistModal.classList.add('hidden');
        areaChecklistModal.classList.remove('flex');
    };

    const openHotelModal = (mode = 'add', hotel = {}) => {
        hotelModalForm.reset();
        if (mode === 'add') {
            hotelModalTitle.textContent = 'Tambah Hotel Baru';
            hotelIdInput.value = '';
        } else {
            hotelModalTitle.textContent = 'Ubah Hotel';
            hotelIdInput.value = hotel.hotel_id;
            hotelNameInput.value = hotel.hotel_name;
            hotelAddressInput.value = hotel.address;
        }
        hotelModal.classList.remove('hidden');
        hotelModal.classList.add('flex');
    };

    const closeHotelModal = () => {
        hotelModal.classList.add('hidden');
        hotelModal.classList.remove('flex');
    };

    const renderHotelAssignmentChecklist = async (userIdForEdit) => {
        hotelAssignmentChecklist.innerHTML = `<p class="text-slate-500 text-sm">Memuat hotel...</p>`;
        try {
            // Ambil semua hotel (sebagai admin) dan, jika mengedit, hotel yang sudah ditugaskan ke pengguna
            const [allHotelsRes, assignedHotelsRes] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/hotels`),
                userIdForEdit ? fetchWithAuth(`${API_BASE_URL}/users/${userIdForEdit}/hotels`) : Promise.resolve(null)
            ]);

            if (!allHotelsRes.ok || (assignedHotelsRes && !assignedHotelsRes.ok)) {
                throw new Error('Gagal memuat data penugasan hotel');
            }

            const allHotels = await allHotelsRes.json();
            const assignedHotelIds = assignedHotelsRes ? await assignedHotelsRes.json() : [];
            const assignedSet = new Set(assignedHotelIds);
            
            hotelAssignmentChecklist.innerHTML = '';
            if (allHotels.length === 0) {
                hotelAssignmentChecklist.innerHTML = `<p class="text-slate-500 text-sm">Tidak ada hotel untuk ditugaskan</p>`;
                return;
            }

            allHotels.forEach(hotel => {
                const isChecked = assignedSet.has(hotel.hotel_id);
                hotelAssignmentChecklist.innerHTML += `
                    <label class="flex items-center text-sm">
                        <input type="checkbox" value="${hotel.hotel_id}" class="hotel-assignment-cb h-4 w-4 text-blue-600 border-slate-300 rounded mr-2" ${isChecked ? 'checked' : ''}>
                        ${hotel.hotel_name}
                    </label>`;
            });
        } catch (error) {
            hotelAssignmentChecklist.innerHTML = `<p class="text-red-500 text-sm">Terjadi kesalahan: ${error.message}</p>`;
        }
    };

    const openUserModal = (mode = 'add', user = {}) => {
        userModalForm.reset();
        userRoleSelect.value = ""; // Pastikan dropdown peran direset ke placeholder
        if (mode === 'add') {
            userModalTitle.textContent = 'Tambah Pengguna Baru';
            userIdInput.value = '';
            userPasswordInput.required = true;
            passwordHelpText.classList.add('hidden');
            renderHotelAssignmentChecklist(); // Panggil tanpa ID untuk mengisi pilihan hotel
        } else {
            userModalTitle.textContent = 'Ubah Pengguna';
            userIdInput.value = user.user_id;
            userUsernameInput.value = user.username;
            userEmailInput.value = user.email;
            userRoleSelect.value = user.role;
            userPasswordInput.required = false;
            passwordHelpText.classList.remove('hidden');
            renderHotelAssignmentChecklist(user.user_id); // Panggil dengan ID pengguna untuk mengisi dan memilih
        }
        userModal.classList.remove('hidden');
        userModal.classList.add('flex');
    };
    
    const closeUserModal = () => {
        userModal.classList.add('hidden');
        userModal.classList.remove('flex');
    };
    
    const renderRolesPage = async () => {
        if (!rolesContainer) return;
        rolesContainer.innerHTML = `<p class="col-span-full text-center text-slate-500">Memuat data peran...</p>`;
        try {
            // Ambil semua peran dan semua izin yang tersedia secara bersamaan
            const [rolesRes, permissionsRes] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/roles`),
                fetchWithAuth(`${API_BASE_URL}/permissions`)
            ]);

            if (!rolesRes.ok || !permissionsRes.ok) throw new Error('Gagal memuat data peran dan izin');

            const roles = await rolesRes.json();
            const allPermissions = await permissionsRes.json();
    
            rolesContainer.innerHTML = '';
            roles.forEach(role => {
                const roleCard = document.createElement('div');
                roleCard.className = 'bg-white p-6 rounded-lg shadow-sm';
                roleCard.dataset.roleName = role.role_name;

                // Buat daftar checklist izin
                const permissionsList = allPermissions.map(p => {
                    const isChecked = role.permissions.includes(p.permission_id);
                    // Admin tidak bisa diubah hak aksesnya
                    const isDisabled = role.role_name === 'admin' ? 'disabled' : '';
                    return `
                        <label class="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50">
                            <input type="checkbox" 
                                   class="permission-cb h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" 
                                   data-permission-id="${p.permission_id}" 
                                   ${isChecked ? 'checked' : ''}
                                   ${isDisabled}>
                            <span class="text-sm text-slate-700">${p.description}</span>
                        </label>
                    `;
                }).join('');

                roleCard.innerHTML = `
                    <h3 class="text-xl font-bold text-slate-800 border-b pb-3 mb-4">${role.display_name}</h3>
                    <div class="space-y-2">
                        ${permissionsList}
                    </div>
                `;
                rolesContainer.appendChild(roleCard);
            });
            feather.replace();
        } catch (error) {
            console.error('Error rendering roles page:', error);
            rolesContainer.innerHTML = `<p class="col-span-full text-center p-8 text-red-500">Terjadi kesalahan: ${error.message}</p>`;
        }
    };

    // Event listener untuk tombol simpan di halaman Kelola Peran
    const saveRolesBtn = document.getElementById('save-roles-btn');
    if (saveRolesBtn) {
        saveRolesBtn.addEventListener('click', async () => {
            const roleCards = document.querySelectorAll('#roles-container .bg-white');
            const promises = [];

            roleCards.forEach(card => {
                const roleName = card.dataset.roleName;
                if (roleName === 'admin') return; // Lewati admin

                const checkedPermissions = Array.from(card.querySelectorAll('.permission-cb:checked'))
                    .map(cb => cb.dataset.permissionId);

                const promise = fetchWithAuth(`${API_BASE_URL}/roles/${roleName}/permissions`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ permissions: checkedPermissions })
                });
                promises.push(promise);
            });

            try {
                await Promise.all(promises);
                alert('Izin berhasil diperbarui.');
            } catch (error) {
                alert('Terjadi kesalahan saat menyimpan izin.');
                console.error('Error saving role permissions:', error);
            }
        });
    }

    // --- GENERIC TABLE RENDERER ---

    // Helper untuk mengatur pesan status tabel (memuat, kosong, error)
    const setTableState = (tableBody, columns, message, type = 'info') => {
        const textColor = type === 'error' ? 'text-red-500' : 'text-slate-500';
        tableBody.innerHTML = `<tr><td colspan="${columns}" class="text-center p-8 ${textColor}">${message}</td></tr>`;
    };

    // Helper untuk mengambil dan mem-parsing data tabel
    const fetchTableData = async (endpoint, errorMessage) => {
        const response = await fetchWithAuth(endpoint);
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                // Jika respons bukan JSON, buat pesan error generik
                errorData = { message: 'Respons server tidak valid.' };
            }
            throw new Error(errorData.message || errorMessage);
        }
        return await response.json();
    };

    const renderTable = async ({
        tableBody,
        endpoint,
        columns,
        rowGenerator,
        noDataMessage = 'Belum ada data yang ditambahkan.',
        errorMessage = 'Terjadi kesalahan saat mengambil data.',
        requiresHotelId = false
    }) => {
        if (!tableBody) return;

        let finalEndpoint = endpoint;
        if (requiresHotelId) {
            const hotelId = getCurrentHotelId();
            if (!hotelId || hotelId === 'all') {
                setTableState(tableBody, columns, 'Pilih hotel spesifik untuk mengelola.');
                return;
            }
            finalEndpoint += `?hotel_id=${hotelId}`;
        }

        setTableState(tableBody, columns, 'Memuat data...');

        try {
            const data = await fetchTableData(finalEndpoint, errorMessage);

            if (data.length === 0) {
                setTableState(tableBody, columns, noDataMessage);
                return;
            }

            tableBody.innerHTML = ''; // Hapus status 'memuat'
            const fragment = document.createDocumentFragment();
            data.forEach(item => {
                const row = document.createElement('tr');
                row.className = 'border-b border-slate-200 hover:bg-slate-50';
                row.innerHTML = rowGenerator(item, currentUser);
                fragment.appendChild(row);
            });
            tableBody.appendChild(fragment);
        } catch (error) {
            console.error(`Error rendering table for ${endpoint}:`, error);
            setTableState(tableBody, columns, `Terjadi kesalahan: ${error.message}`, 'error');
        }
    };

    // --- SETUP MANAGEMENT PAGES (using the generic renderer) ---
    const setupManagementPage = {
        rooms: () => renderTable({ tableBody: roomsTableBody, endpoint: `${API_BASE_URL}/rooms`, columns: 3, requiresHotelId: true, rowGenerator: (room, user) => `<td class="p-4">${room.room_number}</td><td class="p-4">${room.room_type}</td><td class="p-4 space-x-4">${user.role === 'admin' ? `<button class="edit-room-btn font-medium text-blue-600 hover:text-blue-800" data-id="${room.room_id}" data-number="${room.room_number}" data-type="${room.room_type}">Ubah</button><button class="delete-room-btn font-medium text-red-600 hover:text-red-800" data-id="${room.room_id}" data-number="${room.room_number}">Hapus</button>` : '-'}</td>` }),
        areas: () => renderTable({ tableBody: areasTableBody, endpoint: `${API_BASE_URL}/areas`, columns: 2, requiresHotelId: true, rowGenerator: (area, user) => `<td class="p-4">${area.area_name}</td><td class="p-4 space-x-4">${user.role === 'admin' ? `<button class="edit-area-btn font-medium text-blue-600 hover:text-blue-800" data-id="${area.area_id}" data-name="${area.area_name}">Ubah</button><button class="delete-area-btn font-medium text-red-600 hover:text-red-800" data-id="${area.area_id}" data-name="${area.area_name}">Hapus</button>` : '-'}</td>` }),
        roomChecklist: () => renderTable({ tableBody: roomChecklistTableBody, endpoint: `${API_BASE_URL}/room-checklist-items`, columns: 2, rowGenerator: (item, user) => `<td class="p-4">${item.item_name}</td><td class="p-4 space-x-4">${user.role === 'admin' ? `<button class="edit-checklist-item-btn font-medium text-blue-600 hover:text-blue-800" data-id="${item.item_id}" data-name="${item.item_name}">Ubah</button><button class="delete-checklist-item-btn font-medium text-red-600 hover:text-red-800" data-id="${item.item_id}" data-name="${item.item_name}">Hapus</button>` : '-'}</td>` }),
        areaChecklist: () => renderTable({ tableBody: areaChecklistTableBody, endpoint: `${API_BASE_URL}/area-checklist-items`, columns: 2, rowGenerator: (item, user) => `<td class="p-4">${item.item_name}</td><td class="p-4 space-x-4">${user.role === 'admin' ? `<button class="edit-area-checklist-item-btn font-medium text-blue-600 hover:text-blue-800" data-id="${item.item_id}" data-name="${item.item_name}">Ubah</button><button class="delete-area-checklist-item-btn font-medium text-red-600 hover:text-red-800" data-id="${item.item_id}" data-name="${item.item_name}">Hapus</button>` : '-'}</td>` }),
        hotels: () => renderTable({ tableBody: hotelsTableBody, endpoint: `${API_BASE_URL}/hotels`, columns: 3, rowGenerator: (hotel, user) => `<td class="p-4">${hotel.hotel_name}</td><td class="p-4 text-sm text-slate-500">${hotel.address || '-'}</td><td class="p-4 space-x-4">${user.role === 'admin' ? `<button class="edit-hotel-btn font-medium text-blue-600 hover:text-blue-800" data-id="${hotel.hotel_id}" data-name="${hotel.hotel_name}" data-address="${hotel.address || ''}">Ubah</button><button class="delete-hotel-btn font-medium text-red-600 hover:text-red-800" data-id="${hotel.hotel_id}" data-name="${hotel.hotel_name}">Hapus</button>` : '-'}</td>` }),
        users: () => renderTable({ 
            tableBody: usersTableBody, 
            endpoint: `${API_BASE_URL}/users`, 
            columns: 5, 
            rowGenerator: (user, currentUser) => { 
                let roleBadge;
                switch (user.role) {
                    case 'admin': roleBadge = `<span class="px-2 py-1 text-xs font-semibold leading-tight text-red-700 bg-red-100 rounded-full">Admin</span>`; break;
                    case 'teknisi': roleBadge = `<span class="px-2 py-1 text-xs font-semibold leading-tight text-blue-700 bg-blue-100 rounded-full">Teknisi</span>`; break;
                    default: roleBadge = `<span class="px-2 py-1 text-xs font-semibold leading-tight text-green-700 bg-green-100 rounded-full">Inspektor</span>`;
                }
                
                const deleteButtonDisabled = currentUser && currentUser.id === user.user_id ? 'disabled' : ''; 
                const deleteButtonClasses = currentUser && currentUser.id === user.user_id ? 'font-medium text-slate-400 cursor-not-allowed' : 'font-medium text-red-600 hover:text-red-800';
                
                const assignedHotelsHtml = user.assigned_hotels && user.assigned_hotels.length > 0
                    ? user.assigned_hotels.map(name => `<span class="inline-block bg-slate-200 text-slate-700 text-xs font-medium my-0.5 mr-1 px-2 py-0.5 rounded-full">${name}</span>`).join(' ')
                    : `<span class="text-slate-400 text-xs">Tidak ada</span>`;

                return `
                    <td class="p-4">${user.username}</td>
                    <td class="p-4">${user.email}</td>
                    <td class="p-4">${assignedHotelsHtml}</td>
                    <td class="p-4">${roleBadge}</td>
                    <td class="p-4 space-x-4">
                        <button class="edit-user-btn font-medium text-blue-600 hover:text-blue-800" data-user='${JSON.stringify(user)}'>Ubah</button>
                        <button class="delete-user-btn ${deleteButtonClasses}" data-id="${user.user_id}" data-username="${user.username}" ${deleteButtonDisabled}>Hapus</button>
                    </td>`; 
            }
        })
    };

    const populateHotelSelector = async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/hotels`);
            if (!response.ok) {
                const errorText = await response.text();
                let errorData = { message: 'Gagal memuat hotel yang dapat diakses.' };
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    console.error(`Server response for hotels was not JSON:`, errorText);
                    errorData.message = 'Respons server tidak valid atau endpoint salah.';
                }
                throw new Error(errorData.message);
            }
            const hotels = await response.json();
    
            // Logika baru: Tampilkan teks jika hanya 1 hotel, atau dropdown jika lebih dari 1
            if (hotels.length === 1 && currentUser.role !== 'admin') {
                hotelSelector.classList.add('hidden');
                hotelDisplayName.classList.remove('hidden');
                hotelDisplayName.textContent = hotels[0].hotel_name;
                setCurrentHotelId(hotels[0].hotel_id);
            } else {
                hotelSelector.classList.remove('hidden');
                hotelDisplayName.classList.add('hidden');
                hotelSelector.innerHTML = '';

                if (hotels.length === 0) {
                    hotelSelector.innerHTML = `<option value="">Belum ada hotel.</option>`;
                    return;
                }

                // Tambahkan opsi "Semua Hotel" untuk admin jika ada lebih dari 1 hotel
                if (currentUser.role === 'admin' && hotels.length > 1) {
                    const allOption = document.createElement('option');
                    allOption.value = 'all';
                    allOption.textContent = 'Semua Hotel';
                    hotelSelector.appendChild(allOption);
                }

                hotels.forEach(hotel => {
                    const option = document.createElement('option');
                    option.value = hotel.hotel_id;
                    option.textContent = hotel.hotel_name;
                    hotelSelector.appendChild(option);
                });

                const storedHotelId = getCurrentHotelId();
                if (storedHotelId && (hotels.some(h => h.hotel_id == storedHotelId) || storedHotelId === 'all')) {
                    hotelSelector.value = storedHotelId;
                } else {
                    hotelSelector.value = hotelSelector.options[0].value;
                    setCurrentHotelId(hotelSelector.value);
                }
            }
        } catch (error) {
            console.error('Error populating hotel selector:', error);
            hotelSelector.innerHTML = `<option value="">Terjadi kesalahan: ${error.message}</option>`;
        }
    };

    // --- EVENT LISTENERS ---
    sidebarLinks.forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); switchPage(link.dataset.page); }));

    // Mobile sidebar toggles
    mobileMenuButton.addEventListener('click', toggleSidebar);
    sidebarCloseButton.addEventListener('click', toggleSidebar);
    sidebarBackdrop.addEventListener('click', toggleSidebar);

    if (dashboardStatsContainer) {
        dashboardStatsContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.stat-card-clickable');
            if (!card || !card.dataset.status) return;
    
            // Set the filter state
            reportFilters = {
                status: card.dataset.status
            };
    
            // Clear date inputs on the report page to avoid confusion
            document.getElementById('report-start-date').value = '';
            document.getElementById('report-end-date').value = '';
    
            // Switch to the reports page
            switchPage('reports-page');
        });
    }

    hotelSelector.addEventListener('change', () => {
        setCurrentHotelId(hotelSelector.value);
        const activePage = document.querySelector('.page-content:not(.hidden)').id;
        switchPage(activePage);
    });

    // Inspection page card navigation
    selectRoomCard.addEventListener('click', (e) => {
        e.preventDefault();
        showFormView('room');
    });

    selectAreaCard.addEventListener('click', (e) => {
        e.preventDefault();
        showFormView('area');
    });

    backToSelectionBtn.addEventListener('click', () => showSelectionView());

    if (roomForm) {
        roomForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData();
            let overallStatus = 'Baik';
            document.querySelectorAll('#room-checklist-dynamic input[type="radio"]:checked').forEach(item => { if (item.value === 'Kurang') overallStatus = 'Kurang'; });
            
            // Tambahkan data teks ke FormData
            formData.append('roomNumber', document.getElementById('room-number-select').value);
            formData.append('inspectorName', document.getElementById('inspector-name-room').value);
            formData.append('notes', document.getElementById('notes-room').value);
            formData.append('overallStatus', overallStatus);
            formData.append('hotelId', getCurrentHotelId());
    
            // Tambahkan file foto ke FormData
            const files = photosRoomInput.files;
            for (let i = 0; i < files.length; i++) {
                formData.append('photos', files[i]);
            }
    
            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/inspections/room`, {
                    method: 'POST',
                    body: formData // Kirim sebagai FormData
                });
    
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Gagal menyimpan inspeksi kamar!');
                }
    
                renderShortHistory(getCurrentHotelId());
                roomForm.reset();
                photosPreviewRoom.innerHTML = ''; // Kosongkan preview setelah berhasil
                showSelectionView();
                alert('Inspeksi kamar berhasil disimpan!');
            } catch (error) {
                console.error('Error submitting room inspection:', error);
                alert(`Terjadi kesalahan: ${error.message}`);
            }
        });
    }

    if (areaForm) {
        areaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData();
            let overallStatus = 'Baik';
            document.querySelectorAll('#area-checklist-dynamic input[type="radio"]:checked').forEach(item => { if (item.value === 'Kurang') overallStatus = 'Kurang'; });
    
            // Tambahkan data teks ke FormData
            formData.append('areaName', document.getElementById('area-name').value);
            formData.append('inspectorName', document.getElementById('inspector-name-area').value);
            formData.append('notes', document.getElementById('notes-area').value);
            formData.append('overallStatus', overallStatus);
            formData.append('hotelId', getCurrentHotelId());
    
            // Tambahkan file foto ke FormData
            const files = photosAreaInput.files;
            for (let i = 0; i < files.length; i++) {
                formData.append('photos', files[i]);
            }
    
            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/inspections/area`, {
                    method: 'POST',
                    body: formData // Kirim sebagai FormData
                });
    
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Gagal menyimpan inspeksi area!');
                }
    
                renderShortHistory(getCurrentHotelId());
                areaForm.reset();
                photosPreviewArea.innerHTML = ''; // Kosongkan preview setelah berhasil
                showSelectionView();
                alert('Inspeksi area berhasil disimpan!');
            } catch (error) {
                console.error('Error submitting area inspection:', error);
                alert(`Terjadi kesalahan: ${error.message}`);
            }
        });
    }

    // Room Management Event Listeners
    document.getElementById('add-room-btn').addEventListener('click', () => openRoomModal('add'));
    document.getElementById('cancel-room-modal-btn').addEventListener('click', closeRoomModal);
    roomModal.addEventListener('click', (e) => { if (e.target === roomModal) closeRoomModal(); });

    roomModalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const roomId = roomIdInput.value;
        const roomData = { 
            room_number: roomNumberInput.value, 
            room_type: roomTypeInput.value,
            hotel_id: getCurrentHotelId()
        };
        const url = roomId ? `${API_BASE_URL}/rooms/${roomId}` : `${API_BASE_URL}/rooms`;
        const method = roomId ? 'PUT' : 'POST';

        try {
            const response = await fetchWithAuth(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roomData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || `Gagal untuk ${roomId ? 'memperbarui' : 'menambah'} kamar.`);
            
            closeRoomModal();
            setupManagementPage.rooms();
            populateRoomDropdown(getCurrentHotelId()); // Perbarui dropdown di form inspeksi
            alert(`Kamar berhasil ${roomId ? 'diperbarui' : 'ditambahkan'}!`);
        } catch (error) {
            console.error('Error saving room:', error);
            alert(`Terjadi kesalahan: ${error.message}`);
        }
    });

    roomsTableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('edit-room-btn')) {
            openRoomModal('edit', {
                room_id: e.target.dataset.id,
                room_number: e.target.dataset.number,
                room_type: e.target.dataset.type
            });
        }
        if (e.target.classList.contains('delete-room-btn')) {
            const roomId = e.target.dataset.id;
            const roomNumber = e.target.dataset.number;
            if (confirm(`Apakah Anda yakin ingin menghapus Kamar ${roomNumber}?`)) {
                try {
                    const response = await fetchWithAuth(`${API_BASE_URL}/rooms/${roomId}`, { method: 'DELETE' });
                    if (!response.ok && response.status !== 204) {
                        const result = await response.json();
                        throw new Error(result.message || 'Gagal menghapus kamar.');
                    }
                    setupManagementPage.rooms();
                    populateRoomDropdown(getCurrentHotelId()); // Perbarui dropdown di form inspeksi
                    alert(`Kamar ${roomNumber} berhasil dihapus.`);
                } catch (error) {
                    console.error('Error deleting room:', error);
                    alert(`Terjadi kesalahan: ${error.message}`);
                }
            }
        }
    });

    // Area Management Event Listeners
    document.getElementById('add-area-btn').addEventListener('click', () => openAreaModal('add'));
    document.getElementById('cancel-area-modal-btn').addEventListener('click', closeAreaModal);
    areaModal.addEventListener('click', (e) => { if (e.target === areaModal) closeAreaModal(); });

    areaModalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const areaId = areaIdInput.value;
        const areaData = { 
            area_name: areaNameInput.value,
            hotel_id: getCurrentHotelId()
        };
        const url = areaId ? `${API_BASE_URL}/areas/${areaId}` : `${API_BASE_URL}/areas`;
        const method = areaId ? 'PUT' : 'POST';

        try {
            const response = await fetchWithAuth(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(areaData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || `Gagal untuk ${areaId ? 'memperbarui' : 'menambah'} area.`);
            
            closeAreaModal();
            setupManagementPage.areas();
            populateAreaDropdown(getCurrentHotelId()); // Perbarui dropdown di form inspeksi
            alert(`Area berhasil ${areaId ? 'diperbarui' : 'ditambahkan'}!`);
        } catch (error) {
            console.error('Error saving area:', error);
            alert(`Terjadi kesalahan: ${error.message}`);
        }
    });

    areasTableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('edit-area-btn')) {
            openAreaModal('edit', {
                area_id: e.target.dataset.id,
                area_name: e.target.dataset.name
            });
        }
        if (e.target.classList.contains('delete-area-btn')) {
            const areaId = e.target.dataset.id;
            const areaName = e.target.dataset.name;
            if (confirm(`Apakah Anda yakin ingin menghapus area "${areaName}"?`)) {
                try {
                    const response = await fetchWithAuth(`${API_BASE_URL}/areas/${areaId}`, { method: 'DELETE' });
                    if (!response.ok && response.status !== 204) {
                        const result = await response.json();
                        throw new Error(result.message || 'Gagal menghapus area.');
                    }
                    setupManagementPage.areas();
                    populateAreaDropdown(getCurrentHotelId()); // Perbarui dropdown di form inspeksi
                    alert(`Area "${areaName}" berhasil dihapus.`);
                } catch (error) {
                    console.error('Error deleting area:', error);
                    alert(`Terjadi kesalahan: ${error.message}`);
                }
            }
        }
    });

    // Room Checklist Management Event Listeners
    document.getElementById('add-checklist-item-btn').addEventListener('click', () => openRoomChecklistModal('add'));
    document.getElementById('cancel-checklist-modal-btn').addEventListener('click', closeRoomChecklistModal);
    roomChecklistModal.addEventListener('click', (e) => { if (e.target === roomChecklistModal) closeRoomChecklistModal(); });

    roomChecklistModalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemId = checklistItemIdInput.value;
        const itemData = { item_name: checklistItemNameInput.value };
        const url = itemId ? `${API_BASE_URL}/room-checklist-items/${itemId}` : `${API_BASE_URL}/room-checklist-items`;
        const method = itemId ? 'PUT' : 'POST';

        try {
            const response = await fetchWithAuth(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || `Gagal untuk ${itemId ? 'memperbarui' : 'menambah'} item.`);
            
            closeRoomChecklistModal();
            setupManagementPage.roomChecklist();
            renderDynamicRoomChecklist(); // Perbarui form inspeksi
            alert(`Item berhasil ${itemId ? 'diperbarui' : 'ditambahkan'}!`);
        } catch (error) {
            console.error('Error saving checklist item:', error);
            alert(`Terjadi kesalahan: ${error.message}`);
        }
    });

    roomChecklistTableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('edit-checklist-item-btn')) {
            openRoomChecklistModal('edit', {
                item_id: e.target.dataset.id,
                item_name: e.target.dataset.name
            });
        }
        if (e.target.classList.contains('delete-checklist-item-btn')) {
            const itemId = e.target.dataset.id;
            const itemName = e.target.dataset.name;
            if (confirm(`Apakah Anda yakin ingin menghapus item "${itemName}"?`)) {
                try {
                    const response = await fetchWithAuth(`${API_BASE_URL}/room-checklist-items/${itemId}`, { method: 'DELETE' });
                    if (!response.ok && response.status !== 204) {
                        const result = await response.json();
                        throw new Error(result.message || 'Gagal menghapus item.');
                    }
                    setupManagementPage.roomChecklist();
                    renderDynamicRoomChecklist(); // Perbarui form inspeksi
                    alert(`Item "${itemName}" berhasil dihapus.`);
                } catch (error) {
                    console.error('Error deleting checklist item:', error);
                    alert(`Terjadi kesalahan: ${error.message}`);
                }
            }
        }
    });

    // Event listener untuk preview gambar
    if (photosRoomInput) {
        photosRoomInput.addEventListener('change', () => {
            photosPreviewRoom.innerHTML = ''; // Kosongkan preview sebelumnya
            const files = photosRoomInput.files;
            if (files.length > 5) {
                alert('Anda hanya dapat mengunggah maksimal 5 foto.');
                photosRoomInput.value = ''; // Reset input
                return;
            }
            for (const file of files) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const div = document.createElement('div');
                    div.className = 'relative w-full h-24';
                    div.innerHTML = `<img src="${e.target.result}" alt="${file.name}" class="w-full h-full object-cover rounded-md shadow-sm">`;
                    photosPreviewRoom.appendChild(div);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Event listener untuk preview gambar di form area
    if (photosAreaInput) {
        photosAreaInput.addEventListener('change', () => {
            photosPreviewArea.innerHTML = ''; // Kosongkan preview sebelumnya
            const files = photosAreaInput.files;
            if (files.length > 5) {
                alert('Anda hanya dapat mengunggah maksimal 5 foto.');
                photosAreaInput.value = ''; // Reset input
                return;
            }
            for (const file of files) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const div = document.createElement('div');
                    div.className = 'relative w-full h-24';
                    div.innerHTML = `<img src="${e.target.result}" alt="${file.name}" class="w-full h-full object-cover rounded-md shadow-sm">`;
                    photosPreviewArea.appendChild(div);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Hotel Management Event Listeners
    if (document.getElementById('add-hotel-btn')) {
        document.getElementById('add-hotel-btn').addEventListener('click', () => openHotelModal('add'));
    }
    if (document.getElementById('cancel-hotel-modal-btn')) {
        document.getElementById('cancel-hotel-modal-btn').addEventListener('click', closeHotelModal);
    }
    if (hotelModal) {
        hotelModal.addEventListener('click', (e) => { if (e.target === hotelModal) closeHotelModal(); });
    }

    if (hotelModalForm) {
        hotelModalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const hotelId = hotelIdInput.value;
            const hotelData = {
                hotel_name: hotelNameInput.value,
                address: hotelAddressInput.value
            };
            const url = hotelId ? `${API_BASE_URL}/hotels/${hotelId}` : `${API_BASE_URL}/hotels`;
            const method = hotelId ? 'PUT' : 'POST';

            try {
                const response = await fetchWithAuth(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(hotelData)
                });
                const result = await response.json();
            if (!response.ok) throw new Error(result.message || `Gagal untuk ${hotelId ? 'memperbarui' : 'menambah'} hotel.`);
                
                closeHotelModal();
                setupManagementPage.hotels();
                await populateHotelSelector(); // Refresh the main selector
            alert(`Hotel berhasil ${hotelId ? 'diperbarui' : 'ditambahkan'}!`);
            } catch (error) {
                console.error('Error saving hotel:', error);
            alert(`Terjadi kesalahan: ${error.message}`);
            }
        });
    }

    if (hotelsTableBody) {
        hotelsTableBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('edit-hotel-btn')) {
                openHotelModal('edit', {
                    hotel_id: e.target.dataset.id,
                    hotel_name: e.target.dataset.name,
                    address: e.target.dataset.address
                });
            }
            if (e.target.classList.contains('delete-hotel-btn')) {
                const hotelId = e.target.dataset.id;
                const hotelName = e.target.dataset.name;
                if (confirm(`Apakah Anda yakin ingin menghapus hotel "${hotelName}"? Tindakan ini juga akan menghapus semua data terkait (kamar, area, inspeksi, dll).`)) {
                    try {
                        const response = await fetchWithAuth(`${API_BASE_URL}/hotels/${hotelId}`, { method: 'DELETE' });
                        if (!response.ok && response.status !== 204) {
                            const result = await response.json();
                            throw new Error(result.message || 'Gagal menghapus hotel.');
                        }
                        setupManagementPage.hotels();
                        await populateHotelSelector(); // Refresh the main selector
                        alert(`Hotel "${hotelName}" berhasil dihapus.`);
                    } catch (error) {
                        alert(`Terjadi kesalahan: ${error.message}`);
                    }
                }
            }
        });
    }

    // Area Checklist Management Event Listeners
    document.getElementById('add-area-checklist-item-btn').addEventListener('click', () => openAreaChecklistModal('add'));
    document.getElementById('cancel-area-checklist-modal-btn').addEventListener('click', closeAreaChecklistModal);
    areaChecklistModal.addEventListener('click', (e) => { if (e.target === areaChecklistModal) closeAreaChecklistModal(); });

    areaChecklistModalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemId = areaChecklistItemIdInput.value;
        const itemData = { item_name: areaChecklistItemNameInput.value };
        const url = itemId ? `${API_BASE_URL}/area-checklist-items/${itemId}` : `${API_BASE_URL}/area-checklist-items`;
        const method = itemId ? 'PUT' : 'POST';

        try {
            const response = await fetchWithAuth(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || `Gagal untuk ${itemId ? 'memperbarui' : 'menambah'} item.`);
            
            closeAreaChecklistModal();
            setupManagementPage.areaChecklist();
            renderDynamicAreaChecklist(); // Perbarui form inspeksi
            alert(`Item berhasil ${itemId ? 'diperbarui' : 'ditambahkan'}!`);
        } catch (error) {
            console.error('Error saving area checklist item:', error);
            alert(`Terjadi kesalahan: ${error.message}`);
        }
    });

    areaChecklistTableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('edit-area-checklist-item-btn')) {
            openAreaChecklistModal('edit', {
                item_id: e.target.dataset.id,
                item_name: e.target.dataset.name
            });
        }
        if (e.target.classList.contains('delete-area-checklist-item-btn')) {
            const itemId = e.target.dataset.id;
            const itemName = e.target.dataset.name;
            if (confirm(`Apakah Anda yakin ingin menghapus item "${itemName}"?`)) {
                try {
                    const response = await fetchWithAuth(`${API_BASE_URL}/area-checklist-items/${itemId}`, { method: 'DELETE' });
                    if (!response.ok && response.status !== 204) {
                        const result = await response.json();
                        throw new Error(result.message || 'Gagal menghapus item.');
                    }
                    setupManagementPage.areaChecklist();
                    renderDynamicAreaChecklist(); // Perbarui form inspeksi
                    alert(`Item "${itemName}" berhasil dihapus.`);
                } catch (error) {
                    console.error('Error deleting area checklist item:', error);
                    alert(`Terjadi kesalahan: ${error.message}`);
                }
            }
        }
    });

    if (document.getElementById('add-user-btn')) {
        document.getElementById('add-user-btn').addEventListener('click', () => openUserModal('add'));
    }
    if (document.getElementById('cancel-user-modal-btn')) {
        document.getElementById('cancel-user-modal-btn').addEventListener('click', closeUserModal);
    }
    if (userModal) {
        userModal.addEventListener('click', (e) => { if (e.target === userModal) closeUserModal(); });
    }
    
    if (userModalForm) {
        userModalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = userIdInput.value;
            const userData = { 
                username: userUsernameInput.value,
                email: userEmailInput.value,
                role: userRoleSelect.value,
            };
            if (userPasswordInput.value) {
                userData.password = userPasswordInput.value;
            }
    
            const url = userId ? `${API_BASE_URL}/users/${userId}` : `${API_BASE_URL}/users`;
            const method = userId ? 'PUT' : 'POST';
    
            try {
                const response = await fetchWithAuth(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || `Gagal untuk ${userId ? 'memperbarui' : 'menambah'} pengguna.`);
                
                // Simpan penugasan hotel
                const assignedHotelIds = Array.from(document.querySelectorAll('.hotel-assignment-cb:checked')).map(cb => parseInt(cb.value));
                const finalUserId = userId || result.user_id; // Gunakan ID pengguna baru jika mode 'add'
                await fetchWithAuth(`${API_BASE_URL}/users/${finalUserId}/hotels`, {
                    method: 'PUT',
                    body: JSON.stringify({ hotelIds: assignedHotelIds })
                });
                
                closeUserModal();
                setupManagementPage.users();
                alert(`Pengguna berhasil ${userId ? 'diperbarui' : 'ditambahkan'}!`);
            } catch (error) {
                console.error('Error saving user:', error);
                alert(`Terjadi kesalahan: ${error.message}`);
            }
        });
    }
    
    if (usersTableBody) {
        usersTableBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('edit-user-btn')) {
                const user = JSON.parse(e.target.dataset.user);
                openUserModal('edit', user);
            }
            if (e.target.classList.contains('delete-user-btn')) {
                const userId = e.target.dataset.id;
                const username = e.target.dataset.username;
                if (confirm(`Apakah Anda yakin ingin menghapus pengguna "${username}"?`)) {
                    try {
                        const response = await fetchWithAuth(`${API_BASE_URL}/users/${userId}`, { method: 'DELETE' });
                        if (!response.ok && response.status !== 204) { throw new Error((await response.json()).message || 'Gagal menghapus pengguna.'); }
                        setupManagementPage.users();
                        alert(`Pengguna "${username}" berhasil dihapus.`);
                    } catch (error) { alert(`Terjadi kesalahan: ${error.message}`); }
                }
            }
        });
    }

    if (manageRoomsCard) {
        manageRoomsCard.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('manage-rooms-page');
        });
    }

    if (manageAreasCard) {
        manageAreasCard.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('manage-areas-page');
        });
    }

    if (manageHotelsCard) {
        manageHotelsCard.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('manage-hotels-page');
        });
    }

    if (manageRoomChecklistCard) {
        manageRoomChecklistCard.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('manage-room-checklist-page');
        });
    }

    if (manageAreaChecklistCard) {
        manageAreaChecklistCard.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('manage-area-checklist-page');
        });
    }

    if (manageUsersCard) {
        manageUsersCard.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('manage-users-page');
        });
    }

    if (manageRolesCard) {
        manageRolesCard.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('manage-roles-page');
        });
    }

    // Report Page Event Listeners
    const filterReportBtn = document.getElementById('filter-report-btn');
    const clearReportFilterBtn = document.getElementById('clear-report-filter-btn');
    const reportStatusFilter = document.getElementById('report-status-filter');
    const reportStartDate = document.getElementById('report-start-date');
    const reportEndDate = document.getElementById('report-end-date');

    if (filterReportBtn) {
        filterReportBtn.addEventListener('click', () => {
            // Gabungkan filter, jangan menimpanya
            reportFilters.startDate = reportStartDate.value || undefined;
            reportFilters.endDate = reportEndDate.value || undefined;
            reportFilters.status = reportStatusFilter.value || undefined;
            renderReports(getCurrentHotelId());
        });
    }

    if (clearReportFilterBtn) {
        clearReportFilterBtn.addEventListener('click', () => {
            reportFilters = {}; // Hapus semua filter
            reportStartDate.value = '';
            reportEndDate.value = '';
            reportStatusFilter.value = '';
            renderReports(getCurrentHotelId()); // Muat ulang laporan
        });
    }

    const exportReportsToPdf = () => {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            return alert('Pustaka PDF sedang dimuat, silakan coba lagi.');
        }

        const table = document.querySelector('#reports-page table');
        if (!table) return alert('Tabel laporan tidak ditemukan.');

        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'pt',
            format: 'a4'
        });

        const hotelName = hotelSelector.options[hotelSelector.selectedIndex].text;
        const tableTitle = `Laporan Inspeksi - ${hotelName}`;
        const generatedDate = `Dibuat pada: ${new Date().toLocaleString('id', { dateStyle: 'long', timeStyle: 'short' })}`;

        doc.setFontSize(18);
        doc.text(tableTitle, 40, 50);
        doc.setFontSize(10);
        doc.text(generatedDate, 40, 65);

        // --- Ekstraksi header dan data secara cerdas ---
        const headRow = table.querySelector('thead tr');
        const allThs = Array.from(headRow.querySelectorAll('th'));
        
        const headers = [];
        const columnIndexesToInclude = [];

        // Cari kolom mana yang akan disertakan berdasarkan visibilitas dan konten
        allThs.forEach((th, index) => {
            const headerText = th.textContent.trim();
            // Periksa apakah kolom terlihat dan bukan 'Foto' atau 'Aksi'
            if (th.style.display !== 'none' && headerText !== 'Foto' && headerText !== 'Aksi') {
                headers.push(headerText);
                columnIndexesToInclude.push(index);
            }
        });

        const bodyData = [];
        const dataRows = table.querySelectorAll('tbody tr');
        dataRows.forEach(row => {
            // Pastikan ini adalah baris data, bukan pesan "memuat" atau "tidak ada data".
            if (row.cells.length > 1) {
                const rowData = [];
                // Gunakan indeks yang sudah dikumpulkan untuk mengambil data dari sel yang benar
                columnIndexesToInclude.forEach(colIndex => {
                    rowData.push(row.cells[colIndex] ? row.cells[colIndex].textContent.trim() : '');
                });
                bodyData.push(rowData);
            }
        });

        if (bodyData.length === 0) {
            alert('Tidak ada data untuk diekspor.');
            return;
        }

        // Buat tabel di dalam PDF
        const options = {
            head: [headers],
            body: bodyData,
            startY: 80,
            theme: 'grid',
            headStyles: { fillColor: [22, 160, 133], fontStyle: 'bold' }, // Warna hijau toska
            styles: { fontSize: 8, cellPadding: 5 },
            alternateRowStyles: { fillColor: [240, 240, 240] }
        };

        // Periksa apakah plugin autoTable sudah terpasang dengan benar pada instance jsPDF.
        if (typeof doc.autoTable === 'function') {
            doc.autoTable(options);
        } else {
            console.error('jsPDF-AutoTable function not found.');
            alert('Kesalahan: Fungsi jsPDF-AutoTable tidak ditemukan.');
            return;
        }

        // Simpan file PDF
        doc.save(`Laporan_Inspeksi_${hotelName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const exportReportsToCsv = () => {
        const table = document.querySelector('#reports-page table');
        if (!table) {
            alert('Tabel laporan tidak ditemukan.');
            return;
        }

        // --- Ekstraksi data (sama seperti PDF) ---
        // Logika ini secara cerdas hanya mengambil kolom yang terlihat di layar.
        const allThs = Array.from(table.querySelectorAll('thead th'));
        
        const headers = [];
        const columnIndexesToInclude = [];

        allThs.forEach((th, index) => {
            const headerText = th.textContent.trim();
            if (th.style.display !== 'none' && headerText !== 'Foto' && headerText !== 'Aksi') {
                headers.push(headerText);
                columnIndexesToInclude.push(index);
            }
        });

        const bodyData = [];
        const dataRows = table.querySelectorAll('tbody tr');
        dataRows.forEach(row => {
            // Pastikan ini adalah baris data, bukan pesan "memuat"
            if (row.cells.length > 1) {
                const rowData = [];
                // Gunakan indeks yang sudah dikumpulkan untuk mengambil data dari sel yang benar
                columnIndexesToInclude.forEach(colIndex => {
                    rowData.push(row.cells[colIndex] ? row.cells[colIndex].textContent.trim() : '');
                });
                bodyData.push(rowData);
            }
        });

        if (bodyData.length === 0) {
            alert('Tidak ada data untuk diekspor.');
            return;
        }

        // --- Membuat konten CSV ---
        const escapeCsvCell = (cell) => `"${String(cell || '').replace(/"/g, '""')}"`;
        const headerRow = headers.map(escapeCsvCell).join(',');
        const bodyRows = bodyData.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
        const csvContent = `${headerRow}\r\n${bodyRows}`;

        // --- Memicu unduhan ---
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);

        const hotelSelector = document.getElementById('hotel-selector');
        const hotelName = hotelSelector.options[hotelSelector.selectedIndex].text;
        const fileName = `Laporan_Inspeksi_${hotelName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        link.setAttribute("download", fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (reportsTableBody) {
        reportsTableBody.addEventListener('click', async function(e) {
            // Menangani klik pada tombol hapus
            const deleteBtn = e.target.closest('.delete-report-btn');
            if (deleteBtn) {
                const inspectionId = deleteBtn.dataset.id;
                if (confirm('Apakah Anda yakin ingin menghapus laporan ini? Tindakan ini tidak dapat diurungkan.')) {
                    try {
                        const response = await fetchWithAuth(`${API_BASE_URL}/inspections/${inspectionId}`, {
                            method: 'DELETE'
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || 'Gagal menghapus laporan.');
                        }
                        alert('Laporan berhasil dihapus.');
                        renderReports(getCurrentHotelId()); // Muat ulang tabel laporan
                    } catch (error) {
                        alert(`Terjadi kesalahan: ${error.message}`);
                    }
                }
            }
        });
    }

    // Report Export Event Listener
    if (document.getElementById('export-pdf-btn')) {
        document.getElementById('export-pdf-btn').addEventListener('click', exportReportsToPdf);
    }

    // Report CSV Export Event Listener
    if (document.getElementById('export-csv-btn')) {
        document.getElementById('export-csv-btn').addEventListener('click', exportReportsToCsv);
    }

    // --- Working Order Page Internal Navigation ---
    const showWoSelectionView = () => {
        if (woSelectionView) woSelectionView.classList.remove('hidden');
        if (woListView) woListView.classList.add('hidden');
        if (woFormView) woFormView.classList.add('hidden');
        feather.replace(); // Ensure icons on selection cards are rendered
    };

    if (selectWoListCard) {
        selectWoListCard.addEventListener('click', (e) => {
            e.preventDefault();
            showWoListView();
        });
    }

    const showWoListView = () => {
        woSelectionView.classList.add('hidden');
        woListView.classList.remove('hidden');
        woFormView.classList.add('hidden');
        renderWorkingOrders();
    };

    if (selectWoFormCard) {
        selectWoFormCard.addEventListener('click', (e) => {
            e.preventDefault();
            showWoFormView();
        });
    }

    if (backToWoSelectionFromList) backToWoSelectionFromList.addEventListener('click', showWoSelectionView);
    if (backToWoSelectionFromForm) backToWoSelectionFromForm.addEventListener('click', showWoSelectionView);

    if (woTableBody) {
        woTableBody.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-wo-btn');
            const deleteBtn = e.target.closest('.delete-wo-btn');
    
            if (deleteBtn) {
                const woId = deleteBtn.dataset.id;
                if (confirm(`Apakah Anda yakin ingin menghapus Working Order #${woId}?`)) {
                    try {
                        const response = await fetchWithAuth(`${API_BASE_URL}/working-orders/${woId}`, {
                            method: 'DELETE'
                        });
                        if (response.status !== 204) {
                            const result = await response.json();
                            throw new Error(result.message || 'Gagal menghapus WO.');
                        }
                        alert(`Working Order #${woId} berhasil dihapus.`);
                        renderWorkingOrders(); // Refresh table
                    } catch (error) {
                        alert(`Terjadi kesalahan: ${error.message}`);
                    }
                }
            } else if (editBtn) {
                const woId = editBtn.dataset.id;
                showWoFormView({ woId });
            }
        });
    }

    if (woForm) {
        woForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const woId = woFormIdInput.value;

            // Step 1: Simpan data teks
            const woData = {
                inspection_id: woFormInspectionSelect.value,
                status: woFormStatusSelect.value,
                priority: woFormPrioritySelect.value,
                assignee_id: woFormAssigneeSelect.value,
                start_date: woFormStartDate.value,
                target_completion_date: woFormTargetDate.value,
                materials: woFormMaterialsInput.value,
            };

            const method = woId ? 'PUT' : 'POST';
            const url = woId ? `${API_BASE_URL}/working-orders/${woId}` : `${API_BASE_URL}/working-orders`;

            try {
                const woResponse = await fetchWithAuth(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(woData)
                });

                const result = await woResponse.json();
                if (!woResponse.ok) {
                    throw new Error(result.message || 'Gagal menyimpan WO.');
                }

                const savedWoId = result.wo_id;

                // Step 2: Unggah foto jika ada
                const photosToUpload = woFormPhotosInput.files;
                if (photosToUpload.length > 0) {
                    const photoFormData = new FormData();
                    for (const photo of photosToUpload) {
                        photoFormData.append('photos', photo);
                    }

                    const photoResponse = await fetchWithAuth(`${API_BASE_URL}/working-orders/${savedWoId}/photos`, {
                        method: 'POST',
                        body: photoFormData
                    });

                    if (!photoResponse.ok) {
                        const photoError = await photoResponse.json();
                        throw new Error(`WO disimpan, tetapi unggah foto gagal: ${photoError.message}`);
                    }
                }

                alert(`Working Order berhasil ${woId ? 'diperbarui' : 'disimpan'}!`);
                showWoListView();
            } catch (error) {
                alert(`Terjadi kesalahan: ${error.message}`);
            }
        });
    }

    if (woFormPhotosInput) {
        woFormPhotosInput.addEventListener('change', () => {
            // Jangan hapus foto yang sudah ada saat memilih file baru
            // woFormPhotosPreview.innerHTML = ''; 
            const files = woFormPhotosInput.files;
            if (files.length > 5) {
                alert('Anda hanya dapat mengunggah maksimal 5 foto baru.');
                woFormPhotosInput.value = ''; // Reset input
                return;
            }
            for (const file of files) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const div = document.createElement('div');
                    div.className = 'relative w-full h-24';
                    div.innerHTML = `<img src="${e.target.result}" alt="Pratinjau" class="w-full h-full object-cover rounded-md border-2 border-blue-400">`;
                    woFormPhotosPreview.appendChild(div);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (woFormPhotosPreview) {
        woFormPhotosPreview.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-wo-photo-btn');
            if (!deleteBtn) return;
            const photoId = deleteBtn.dataset.photoId;
            if (!photoId || !confirm('Apakah Anda yakin ingin menghapus foto ini?')) return;

            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/working-orders/photos/${photoId}`, { method: 'DELETE' });
                if (response.status !== 204) throw new Error('Gagal menghapus foto dari server.');
                deleteBtn.parentElement.remove();
                alert('Foto berhasil dihapus.');
            } catch (error) { alert(`Terjadi kesalahan: ${error.message}`); }
        });
    }

    if (woFormStatusSelect) {
        woFormStatusSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Completed') {
                woFormPhotosContainer.classList.remove('hidden');
            } else {
                woFormPhotosContainer.classList.add('hidden');
            }
        });
    }

    if (woFormInspectionSelect) {
        woFormInspectionSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const notes = selectedOption.dataset.notes;
            if (notes) {
                woFormInspectionNotesDisplay.textContent = notes;
                woFormInspectionNotesContainer.classList.remove('hidden');
            } else {
                woFormInspectionNotesContainer.classList.add('hidden');
            }
        });
    }

    if (reportsTableBody) {
        reportsTableBody.addEventListener('click', (e) => {
            const createWoBtn = e.target.closest('.create-wo-btn');
            if (createWoBtn) {
                const inspectionId = createWoBtn.dataset.inspectionId;
                switchPage('working-order-page');
                // Use a timeout to ensure the page switch is complete before showing the form
                setTimeout(() => showWoFormView({ inspectionId }), 50);
            }
        });
    }

    // Photo Viewer Modal Logic
    if (photoViewerModal) {
        // Event delegation for viewing photos
        document.body.addEventListener('click', (e) => {
            const viewBtn = e.target.closest('.view-photos-btn');
            if (viewBtn) {
                const photos = JSON.parse(viewBtn.dataset.photos);
                photoViewerContent.innerHTML = ''; // Clear previous photos

                if (photos && photos.length > 0) {
                    const serverOrigin = new URL(API_BASE_URL).origin; // Dapatkan base URL server, e.g., http://localhost:3000
                    photos.forEach(photo => {
                        const imgContainer = document.createElement('a');
                        const imageUrl = `${serverOrigin}${photo.path}`;
                        imgContainer.href = imageUrl; // Link ke gambar itu sendiri
                        imgContainer.target = '_blank'; // Open in new tab
                        imgContainer.rel = 'noopener noreferrer';
                        imgContainer.className = 'block bg-slate-100 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow';
                        imgContainer.innerHTML = `<img src="${imageUrl}" alt="Foto Inspeksi" class="w-full h-48 object-cover">`;
                        photoViewerContent.appendChild(imgContainer);
                    });
                    photoViewerModal.classList.remove('hidden');
                    photoViewerModal.classList.add('flex');
                    feather.replace();
                }
            }
        });

        closePhotoViewerBtn.addEventListener('click', () => {
            photoViewerModal.classList.add('hidden');
            photoViewerModal.classList.remove('flex');
        });

        // Menutup modal saat mengklik di luar area konten
        photoViewerModal.addEventListener('click', (e) => {
            if (e.target === photoViewerModal) {
                photoViewerModal.classList.add('hidden');
                photoViewerModal.classList.remove('flex');
            }
        });
    }

    if (profileLink) {
        profileLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('profile-page');
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (newPassword !== confirmPassword) {
                return alert('Kata sandi baru tidak cocok.');
            }

            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/auth/change-password`, {
                    method: 'PUT',
                    body: JSON.stringify({ currentPassword, newPassword })
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message || 'Gagal mengubah kata sandi.');
                }

                alert(result.message);
                changePasswordForm.reset();
            } catch (error) {
                alert(`Terjadi kesalahan: ${error.message}`);
            }
        });
    }

    // Back to settings buttons
    const backToSettingsBtns = document.querySelectorAll('.back-to-settings-btn');
    backToSettingsBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('settings-page');
        });
    });

    const setupToggle = (toggleBtn, container, icon) => {
        if (!toggleBtn || !container || !icon) return; // Guard against null elements
        
        // Set initial state to collapsed
        container.style.maxHeight = '0px';
        icon.setAttribute('data-feather', 'chevron-down');

        toggleBtn.addEventListener('click', () => {
            const isCollapsed = container.style.maxHeight === '0px';
            if (isCollapsed) {
                container.style.maxHeight = container.scrollHeight + 'px';
                icon.setAttribute('data-feather', 'chevron-up');
            } else {
                container.style.maxHeight = '0px';
                icon.setAttribute('data-feather', 'chevron-down');
            }
            feather.replace();
        });
    };

    // --- INITIALIZATION ---    
    const initializeApp = async () => {
        const token = localStorage.getItem('authToken');
        if (token) {
            const decodedToken = parseJwt(token);
            if (decodedToken && decodedToken.user) {
                currentUser = decodedToken.user;
                updateUiForRole(currentUser.role);

                // Tampilkan nama pengguna di header
                if (userGreeting) {
                    userGreeting.textContent = `Halo, ${currentUser.username}`;
                }
                // Isi otomatis nama inspektor di form
                if (inspectorNameRoomInput) inspectorNameRoomInput.value = currentUser.username;
                if (inspectorNameAreaInput) inspectorNameAreaInput.value = currentUser.username;
            }
        }

        // Jalankan inisialisasi aplikasi
        await populateHotelSelector(); // Wait for hotels to load
        const hotelId = getCurrentHotelId();
        setupToggle(visualStatusToggle, roomStatusContainer, toggleIcon); // Setup toggles for dashboard
        setupToggle(visualAreaToggle, areaStatusContainer, toggleAreaIcon); // Setup toggles for dashboard
        await switchPage('dashboard-page');
    };

    initializeApp();
});


