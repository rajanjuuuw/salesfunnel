document.addEventListener("DOMContentLoaded", () => {

    // 1. DATA AND CHART INITIALIZATION (Placeholder)
    // Asumsi fungsi-fungsi inisiasi chart (initPLSummaryChart, etc.) sudah didefinisikan di luar block DOMContentLoaded ini
    // Jika semua chart ada di dalam block ini, maka panggil di sini.
    
    // Panggil fungsi inisiasi chart dan data:
    if (typeof initPLSummaryChart === 'function') initPLSummaryChart();
    if (typeof initPLPerProductChart === 'function') initPLPerProductChart();
    if (typeof initPLDeviationChart === 'function') initPLDeviationChart();
    if (typeof initCustomerPieChart === 'function') initCustomerPieChart();
    if (typeof populatePLProductTable === 'function') populatePLProductTable();


    // 2. SIDEBAR NAVIGATION LOGIC (Disinkronkan dengan struktur HTML P/L)
    const commercialToggle = document.getElementById("commercialToggle"); // ID diubah
    const commercialSubmenu = document.getElementById("commercialSubmenu");
    const commercialIcon = commercialToggle ? commercialToggle.querySelector("svg") : null;
    
    const tabButtons = document.querySelectorAll('#sidebarNav .tab-btn'); // Menggunakan class dan ID yang benar
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Inisialisasi: Default tab yang aktif adalah P/L
    const defaultTabId = 'pl';
    
    /**
     * Mengubah tampilan konten dan status tombol sidebar
     * @param {string} tabId - ID tab yang akan ditampilkan (e.g., 'pl', 'operation')
     */
    const switchTab = (tabId) => {
        // Sembunyikan semua konten dan hapus status 'active' dari tombol
        tabContents.forEach(content => {
            content.classList.add('hidden');
        });

        tabButtons.forEach(btn => {
            btn.classList.remove('active', 'bg-gray-100');
            // Menghapus gaya khusus untuk Commercial Toggle
            if (btn.id !== 'commercialToggle') {
                btn.classList.remove('font-semibold');
                btn.classList.add('font-medium', 'text-gray-700', 'hover:bg-gray-100');
            }
        });
        
        // Atur konten target menjadi aktif
        const targetContent = document.getElementById(`tab-${tabId}`);
        if (targetContent) {
            targetContent.classList.remove('hidden');
        }

        // Atur tombol target menjadi aktif
        const activeButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (activeButton) {
            activeButton.classList.add('active', 'bg-gray-100');
            activeButton.classList.remove('font-medium', 'text-gray-700', 'hover:bg-gray-100');
        }
        
        // Pastikan Commercial Toggle (menu induk) tetap aktif dan terbuka jika sub-menu yang dipilih
        if (['pl', 'salesfunnel'].includes(tabId)) {
            if (commercialToggle) {
                commercialToggle.classList.add('active', 'bg-gradient-to-r', 'from-[#001f3f]/80', 'to-[#b71c1c]/80', 'text-white');
                commercialIcon.classList.add('rotate-180');
                commercialSubmenu.classList.remove('hidden');
            }
        } else {
             // Untuk menu utama lainnya (Operation, Market), pastikan sub-menu tertutup
             if (commercialToggle) {
                commercialToggle.classList.remove('active', 'bg-gradient-to-r', 'from-[#001f3f]/80', 'to-[#b71c1c]/80', 'text-white');
                commercialToggle.classList.add('bg-white', 'text-gray-700', 'hover:bg-gray-100');
                // Tidak perlu menutup sub-menu di sini, karena toggle akan menangani itu
             }
        }
        
    };

    // Event Listener untuk Commercial Toggle (menu induk)
    if(commercialToggle) {
        commercialToggle.addEventListener("click", () => {
            commercialSubmenu.classList.toggle("hidden");
            commercialIcon.classList.toggle("rotate-180");
        });
    }

    // Event Listener untuk Navigasi Tab (semua tombol)
    tabButtons.forEach(button => {
        button.addEventListener("click", (e) => {
            // Logika preventDefault TIDAK diperlukan jika tombol tidak berada di dalam tag <a>
            const tabId = e.currentTarget.getAttribute("data-tab");
            switchTab(tabId);
            
            // Tambahkan fokus ke Commercial Toggle jika yang diklik adalah Commercial Toggle itu sendiri
            if (e.currentTarget.id === 'commercialToggle') {
                // Saat Commercial Toggle diklik, pastikan salah satu sub-menu tetap aktif
                if (!commercialSubmenu.classList.contains('hidden')) {
                    // Jika sub-menu dibuka, tidak perlu switch tab
                } else {
                    // Jika sub-menu ditutup, switch ke tab terakhir yang aktif di commercial, atau ke default 'pl'
                    switchTab(defaultTabId); 
                }
            }
        });
    });

    // Inisialisasi default tab
    switchTab(defaultTabId);
    
    
    // --- 3. LOGIKA TAMBAHAN (Mobile Sidebar Toggle, dll.) ---
    // Logika Mobile Toggle dan penutupannya dihapus karena tidak ada elemen mobile-toggle di HTML Anda
    // Asumsi CSS yang Anda gunakan sudah menangani responsive-ness sidebar.
    
    
    // --- 4. EXPORT LOGIC (Minimal) ---
    
    // Example: Export P/L Table to PDF
    const exportPLPdfBtn = document.getElementById('exportPLPdf');
    if (exportPLPdfBtn) {
        exportPLPdfBtn.addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text("P/L Analysis — YTD September 2025", 14, 10);
            
            // Mengambil data tabel P/L per produk
            const tableData = plProductData.map(item => [
                item.produk,
                formatCurrency(item.revenue),
                formatCurrency(item.cost),
                formatCurrency(item.pl)
            ]);
            
            doc.autoTable({
                head: [['Produk', 'Revenue (M)', 'Cost (M)', 'P/L (M)']],
                body: tableData,
                startY: 20
            });
            
            doc.save('PL_Analysis_YTD_Sept_2025.pdf');
        });
    }
});
